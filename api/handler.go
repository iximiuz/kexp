package api

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/iximiuz/kexp/logging"
)

const HeaderRequestID = "X-Request-ID"

func MiddlewareRequestID(c *gin.Context) {
	rid := c.GetHeader(HeaderRequestID)
	if rid == "" {
		rid = uuid.New().String()[:8]
	}

	c.Request = c.Request.WithContext(
		context.WithValue(c.Request.Context(), logging.KeyRequestID, rid),
	)
	c.Header(HeaderRequestID, rid)
	c.Next()
}

type Handler struct {
	logger *logrus.Entry
}

func NewHandler(name string, logger *logrus.Entry) Handler {
	return Handler{
		logger: logger.WithField("handler", name),
	}
}

func (h *Handler) Logger(c *gin.Context) *logrus.Entry {
	return logging.WithRequestID(c.Request.Context(), h.logger)
}
