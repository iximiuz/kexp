package resources

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"github.com/iximiuz/kexp/api"
	"github.com/iximiuz/kexp/kubeclient"
)

type Handler struct {
	api.Handler

	clientPool *kubeclient.ClientPool
}

func NewHandler(clientPool *kubeclient.ClientPool, logger *logrus.Entry) *Handler {
	return &Handler{
		Handler:    api.NewHandler("kube/resources", logger),
		clientPool: clientPool,
	}
}

// kube/v1/contexts/<ctx>/resources
func (h *Handler) List(c *gin.Context) {
	logger := h.Logger(c).
		WithField("method", "List").
		WithField("context", c.Param("ctx"))

	kctx, err := h.clientPool.Context(c.Param("ctx"))
	if err != nil {
		logger.
			WithError(err).
			Error("Unknown context")
		c.AbortWithStatusJSON(
			http.StatusNotFound,
			map[string]string{"error": "unknown context"},
		)
		return
	}

	client, err := kctx.DiscoveryClient()
	if err != nil {
		logger.
			WithError(err).
			Error("Couldn't get Kubernetes client for context")
		c.AbortWithStatusJSON(
			http.StatusInternalServerError,
			map[string]string{"error": "internal server error"},
		)
		return
	}

	resourceList, err := client.ServerPreferredResources()
	if err != nil {
		logger.
			WithError(err).
			Error("Couldn't load Kubernetes preferred resources")
		c.AbortWithStatusJSON(
			http.StatusInternalServerError,
			map[string]string{"error": "internal server error"},
		)
		return
	}

	c.JSON(http.StatusOK, resourceList)
}
