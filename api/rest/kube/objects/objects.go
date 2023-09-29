package objects

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/dynamic"

	"github.com/iximiuz/kexp/api"
	"github.com/iximiuz/kexp/kubeclient"
)

type Handler struct {
	api.Handler

	clientPool *kubeclient.ClientPool
}

func NewHandler(clientPool *kubeclient.ClientPool, logger *logrus.Entry) *Handler {
	return &Handler{
		Handler:    api.NewHandler("kube/objects", logger),
		clientPool: clientPool,
	}
}

// GET kube/v1/contexts/<ctx>/resources/<group>/<version>/<resource>/<name>
// GET kube/v1/contexts/<ctx>/resources/<group>/<version>/namespaces/<ns>/<resource>/<name>
func (h *Handler) Get(c *gin.Context) {
	logger := h.Logger(c).
		WithField("method", "Get").
		WithField("context", c.Param("ctx")).
		WithField("group", c.Param("group")).
		WithField("version", c.Param("version")).
		WithField("resource", c.Param("resource")).
		WithField("namespace", c.Param("namespace")).
		WithField("name", c.Param("name"))

	group := c.Param("group")
	if group == "core" {
		group = ""
	}

	client, err := h.kubeClient(c, logger)
	if err != nil {
		return
	}

	obj, err := client.
		Resource(schema.GroupVersionResource{
			Group:    group,
			Version:  c.Param("version"),
			Resource: c.Param("resource"),
		}).
		Namespace(c.Param("namespace")).
		Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			c.AbortWithStatusJSON(
				http.StatusNotFound,
				map[string]string{"error": "not found"},
			)
			return
		}

		logger.
			WithError(err).
			Error("Couldn't get Kubernetes object")
		c.AbortWithStatusJSON(
			http.StatusInternalServerError,
			map[string]string{"error": "internal server error"},
		)
		return
	}

	c.JSON(http.StatusOK, obj)
}

// TODO:
// ??? kube/v1/contexts/<ctx>/resources/<group>/<version>/<resource>/<name>/<subresource>
// ??? kube/v1/contexts/<ctx>/resources/<group>/<version>/namespaces/<ns>/<resource>/<name>/<subresource>

// GET kube/v1/contexts/<ctx>/resources/<group>/<version>/<resource>
// GET kube/v1/contexts/<ctx>/resources/<group>/<version>/namespaces/<ns>/<resource>
func (h *Handler) List(c *gin.Context) {
	logger := h.Logger(c).
		WithField("method", "List").
		WithField("context", c.Param("ctx")).
		WithField("group", c.Param("group")).
		WithField("version", c.Param("version")).
		WithField("resource", c.Param("resource")).
		WithField("namespace", c.Param("namespace"))

	group := c.Param("group")
	if group == "core" {
		group = ""
	}

	client, err := h.kubeClient(c, logger)
	if err != nil {
		return
	}

	list, err := client.
		Resource(schema.GroupVersionResource{
			Group:    group,
			Version:  c.Param("version"),
			Resource: c.Param("resource"),
		}).
		Namespace(c.Param("namespace")).
		List(c.Request.Context(), metav1.ListOptions{
			FieldSelector: c.Query("fieldSelector"),
			LabelSelector: c.Query("labelSelector"),
		})
	if err != nil {
		logger.
			WithError(err).
			Error("Couldn't list Kubernetes objects")
		c.AbortWithStatusJSON(
			http.StatusInternalServerError,
			map[string]string{"error": "internal server error"},
		)
		return
	}

	c.JSON(http.StatusOK, list.Items)
}

// PUT kube/v1/contexts/<ctx>/resources/<group>/<version>/<resource>/<name>
// PUT kube/v1/contexts/<ctx>/resources/<group>/<version>/namespaces/<ns>/<resource>/<name>
func (h *Handler) Update(c *gin.Context) {
	logger := h.Logger(c).
		WithField("method", "Update").
		WithField("context", c.Param("ctx")).
		WithField("group", c.Param("group")).
		WithField("version", c.Param("version")).
		WithField("resource", c.Param("resource")).
		WithField("namespace", c.Param("namespace")).
		WithField("name", c.Param("name"))

	group := c.Param("group")
	if group == "core" {
		group = ""
	}

	obj, err := h.unstructuredObjectFromRequest(c, logger)
	if err != nil {
		return
	}

	client, err := h.kubeClient(c, logger)
	if err != nil {
		return
	}

	obj, err = client.
		Resource(schema.GroupVersionResource{
			Group:    group,
			Version:  c.Param("version"),
			Resource: c.Param("resource"),
		}).
		Namespace(c.Param("namespace")).
		Update(c.Request.Context(), obj, metav1.UpdateOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		logger.
			WithError(err).
			Error("Couldn't update Kubernetes object")
		c.AbortWithStatusJSON(
			http.StatusInternalServerError,
			map[string]string{"error": "internal server error"},
		)
		return
	}

	c.JSON(http.StatusOK, obj)
}

// DELETE kube/v1/contexts/<ctx>/resources/<group>/<version>/<resource>/<name>
// DELETE kube/v1/contexts/<ctx>/resources/<group>/<version>/namespaces/<ns>/<resource>/<name>
func (h *Handler) Delete(c *gin.Context) {
	logger := h.Logger(c).
		WithField("method", "Delete").
		WithField("context", c.Param("ctx")).
		WithField("group", c.Param("group")).
		WithField("version", c.Param("version")).
		WithField("resource", c.Param("resource")).
		WithField("namespace", c.Param("namespace")).
		WithField("name", c.Param("name"))

	group := c.Param("group")
	if group == "core" {
		group = ""
	}

	client, err := h.kubeClient(c, logger)
	if err != nil {
		return
	}

	err = client.
		Resource(schema.GroupVersionResource{
			Group:    group,
			Version:  c.Param("version"),
			Resource: c.Param("resource"),
		}).
		Namespace(c.Param("namespace")).
		Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		logger.
			WithError(err).
			Error("Couldn't delete Kubernetes object")
		c.AbortWithStatusJSON(
			http.StatusInternalServerError,
			map[string]string{"error": "internal server error"},
		)
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *Handler) kubeClient(
	c *gin.Context,
	logger *logrus.Entry,
) (dynamic.Interface, error) {
	kctx, err := h.clientPool.Context(c.Param("ctx"))
	if err != nil {
		logger.
			WithError(err).
			Error("Unknown context")
		c.AbortWithStatusJSON(
			http.StatusNotFound,
			map[string]string{"error": "unknown context"},
		)
		return nil, err
	}

	client, err := kctx.DynamicClient()
	if err != nil {
		logger.
			WithError(err).
			Error("Couldn't get Kubernetes client for context")
		c.AbortWithStatusJSON(
			http.StatusInternalServerError,
			map[string]string{"error": "internal server error"},
		)
		return nil, err
	}

	return client, nil
}

func (h *Handler) unstructuredObjectFromRequest(
	c *gin.Context,
	logger *logrus.Entry,
) (*unstructured.Unstructured, error) {
	body, err := c.GetRawData()
	if err != nil {
		logger.
			WithError(err).
			Error("Couldn't read request body")
		c.AbortWithStatusJSON(
			http.StatusInternalServerError,
			map[string]string{"error": "internal server error"},
		)
		return nil, err
	}

	logger = logger.WithField("body", body)

	jsonBody, err := yaml.ToJSON(body)
	if err != nil {
		logger.
			WithError(err).
			Error("Couldn't convert YAML to JSON")
		c.AbortWithStatusJSON(
			http.StatusInternalServerError,
			map[string]string{"error": "internal server error"},
		)
		return nil, err
	}

	obj, err := runtime.Decode(unstructured.UnstructuredJSONScheme, jsonBody)
	if err != nil {
		logger.
			WithError(err).
			Error("Couldn't decode Kubernetes object")
		c.AbortWithStatusJSON(
			http.StatusInternalServerError,
			map[string]string{"error": "internal server error"},
		)
		return nil, err
	}

	uns, ok := obj.(*unstructured.Unstructured)
	if !ok {
		logger.
			WithField("object", obj).
			Error("Couldn't type cast runtime.Object to unstructured.Unstructured")
		c.AbortWithStatusJSON(
			http.StatusInternalServerError,
			map[string]string{"error": "internal server error"},
		)
		return nil, err
	}

	return uns, nil
}
