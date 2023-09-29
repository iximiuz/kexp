package stream

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"

	"github.com/iximiuz/kexp/api"
)

type MessageType string

type Message []byte

type MessageHandler interface {
	Handle(ctx context.Context, msg Message, reply chan<- Message) error
}

// Stream handler.
type Handler struct {
	api.Handler

	handlers map[MessageType]MessageHandler
	upgrader websocket.Upgrader
}

func NewHandler(logger *logrus.Entry) *Handler {
	return &Handler{
		Handler:  api.NewHandler("stream", logger),
		handlers: make(map[MessageType]MessageHandler),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// TODO: security
				return true
			},
		},
	}
}

func (h *Handler) Connect(c *gin.Context) {
	logger := h.Logger(c).WithField("method", "connect")

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logger.WithError(err).Error("Couldn't upgrade to ws conn")
		c.JSON(http.StatusInternalServerError, map[string]string{"error": "upgrade failed"})
		return
	}

	newMessageDispatcher(c.Request.Context(), conn, h.handlers, logger).runDispatchLoop()
}

func (h *Handler) RegisterMessageHandler(msgType MessageType, handler MessageHandler) {
	// TODO: Use mutex.
	h.handlers[msgType] = handler
}

// Lives as long as the WebSocket connection.
type messageDispatcher struct {
	ctx    context.Context    // conn's (i.e. http.Request's) ctx
	cancel context.CancelFunc // called when conn terminates or a critical error occurs

	// gorilla supports only 1 concurrent reader and only 1 concurrent writer
	conn         *websocket.Conn
	msgReadLock  sync.Mutex
	msgWriteLock sync.Mutex

	handlers map[MessageType]MessageHandler

	logger *logrus.Entry
}

func newMessageDispatcher(
	ctx context.Context,
	conn *websocket.Conn,
	handlers map[MessageType]MessageHandler,
	logger *logrus.Entry,
) *messageDispatcher {
	ctx, cancel := context.WithCancel(ctx)

	return &messageDispatcher{
		ctx:      ctx,
		cancel:   cancel,
		conn:     conn,
		handlers: handlers,
		logger:   logger,
	}
}

func (d *messageDispatcher) runDispatchLoop() {
	for {
		msg, err := d.readMessage()
		if err != nil || msg == nil {
			break
		}

		partial := struct {
			Type MessageType `json:"type"`
		}{}
		if err := json.Unmarshal(msg, &partial); err != nil {
			d.logger.
				WithError(err).
				WithField("message", msg).
				Warn("Couldn't decode raw ws message")
			continue // Short circuit to the next message.
		}

		// Dispatch message by type. Goroutine should live
		// no longer than the dispatcher's context.
		go d.dispatchMessage(partial.Type, msg)
	}

	// Make sure all dispatch goroutines are stopped (eventually).
	d.cancel()

	if err := d.conn.Close(); err != nil {
		d.logger.WithError(err).Warn("Failed to close ws connection")
	}
}

func (d *messageDispatcher) dispatchMessage(msgType MessageType, msg Message) {
	logger := d.logger.WithField("messageType", msgType)
	logger.Debug("Dispatching message")

	handler, found := d.handlers[msgType]
	if !found {
		logger.
			WithField("message", string(msg)).
			Warn("Unknown message type")
		return
	}

	reply := make(chan Message)

	go func() {
		defer close(reply)

		if err := handler.Handle(d.ctx, msg, reply); err != nil {
			logger.
				WithError(err).
				WithField("message", string(msg)).
				Warn("Message handling failed")
		}
	}()

	for msg := range reply {
		d.writeMessage(msg)
	}
}

func (d *messageDispatcher) readMessage() (Message, error) {
	d.msgReadLock.Lock()
	defer d.msgReadLock.Unlock()

	type result struct {
		data []byte
		err  error
	}
	read := make(chan result)

	go func() {
		msgType, data, err := d.conn.ReadMessage()
		if err != nil {
			d.logger.WithError(err).Error("Couldn't read ws message")
			read <- result{data: nil, err: err}
			return
		}

		if msgType == websocket.CloseMessage {
			d.logger.Info("ws connection has been closed by peer")
			read <- result{data: nil, err: nil}
			return
		}

		read <- result{data: data, err: nil}
	}()

	select {
	case <-d.ctx.Done():
		return nil, nil
	case res := <-read:
		return Message(res.data), res.err
	}
}

func (d *messageDispatcher) writeMessage(msg Message) {
	d.msgWriteLock.Lock()
	defer d.msgWriteLock.Unlock()

	if err := d.conn.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
		d.logger.
			WithError(err).
			WithField("message", string(msg)).
			Warn("couldn't write ws message")

		// It's a fatal condition for the stream.
		d.cancel()
	}
}
