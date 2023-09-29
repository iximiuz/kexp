package contexts

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
		Handler:    api.NewHandler("kube/contexts", logger),
		clientPool: clientPool,
	}
}

// kube/<ver>/contexts
func (h *Handler) List(c *gin.Context) {
	cs := []Context{}
	for _, kctx := range h.clientPool.Contexts() {
		cs = append(cs, Context{
			Name:       kctx.Name(),
			User:       kctx.User(),
			Cluster:    kctx.Cluster(),
			ClusterUID: kctx.ClusterUID(),
			Namespace:  kctx.Namespace(),
			Current:    kctx.Name() == h.clientPool.CurrentContext().Name(),
		})
	}

	c.JSON(http.StatusOK, cs)
}

type Context struct {
	Name       string `json:"name"`
	User       string `json:"user"`
	Cluster    string `json:"cluster"`
	ClusterUID string `json:"clusterUID"`
	Namespace  string `json:"namespace"`
	Current    bool   `json:"current"`
}
