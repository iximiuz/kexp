package objects

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/sirupsen/logrus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/cli-runtime/pkg/printers"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/cache"

	"github.com/iximiuz/kexp/api/stream"
	"github.com/iximiuz/kexp/api/stream/rpc"
	"github.com/iximiuz/kexp/kubeclient"
	"github.com/iximiuz/kexp/logging"
)

const Watch rpc.CallMethod = "kubeObjects.watch"

type paramsWatch struct {
	Context       string `json:"context"`
	Group         string `json:"group"`
	Version       string `json:"version"`
	Resource      string `json:"resource"`
	Namespace     string `json:"namespace"`
	Name          string `json:"name"`
	FieldSelector string `json:"fieldSelector"`
	LabelSelector string `json:"labelSelector"`
}

type WatchHandler struct {
	clientPool *kubeclient.ClientPool
	logger     *logrus.Entry
}

func NewWatchHandler(clientPool *kubeclient.ClientPool) *WatchHandler {
	return &WatchHandler{
		clientPool: clientPool,
		logger:     logrus.WithField("handler", "stream/rpc/kube/objects/watch"),
	}
}

func (h *WatchHandler) Handle(ctx context.Context, call rpc.Call, reply chan<- stream.Message) error {
	if call.Method != Watch {
		return errors.New("call has been misdispatched")
	}

	logger := logging.WithRequestID(ctx, h.logger).
		WithField("callId", call.ID).
		WithField("callMethod", call.Method)

	params := paramsWatch{}
	if err := json.Unmarshal(call.Params, &params); err != nil {
		logger.
			WithError(err).
			Warn("couldn't decode call params")
		return err
	}
	if params.Group == "core" {
		params.Group = ""
	}

	logger = logger.WithField("callParams", &params)
	logger.Debug("Handling RPC call")

	kctx, err := h.clientPool.Context(params.Context)
	if err != nil {
		return err
	}

	kubeClient, err := kctx.DynamicClient()
	if err != nil {
		return err
	}

	factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(
		kubeClient,
		30*time.Second,
		params.Namespace,
		func(opts *metav1.ListOptions) {
			opts.FieldSelector = params.FieldSelector
			if len(params.Name) > 0 {
				if len(opts.FieldSelector) > 0 {
					opts.FieldSelector += ","
				}
				opts.FieldSelector += "metadata.name=" + params.Name
			}
			opts.LabelSelector = params.LabelSelector
		},
	)
	informer := factory.ForResource(schema.GroupVersionResource{
		Group:    params.Group,
		Version:  params.Version,
		Resource: params.Resource,
	})

	factory.Start(ctx.Done())
	for _, ok := range factory.WaitForCacheSync(ctx.Done()) {
		if !ok {
			// The context has been canceled - not much we can do here.
			return nil
		}
	}

	informer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			un, ok := obj.(*unstructured.Unstructured)
			if !ok {
				return
			}

			logger.
				WithField("event", "add").
				WithField("objectName", un.GetName()).
				WithField("objectNamespace", un.GetNamespace()).
				Trace("Informer event")

			reply <- encodeResponse(call, obj.(runtime.Object), "added", nil)
		},
		UpdateFunc: func(_, newObj interface{}) {
			un, ok := newObj.(*unstructured.Unstructured)
			if !ok {
				return
			}

			logger.
				WithField("event", "update").
				WithField("objectName", un.GetName()).
				WithField("objectNamespace", un.GetNamespace()).
				Trace("Informer event")

			reply <- encodeResponse(call, newObj.(runtime.Object), "updated", nil)
		},
		DeleteFunc: func(obj interface{}) {
			un, ok := obj.(*unstructured.Unstructured)
			if !ok {
				return
			}
			logger.
				WithField("event", "delete").
				WithField("objectName", un.GetName()).
				WithField("objectNamespace", un.GetNamespace()).
				Trace("Informer event")

			reply <- encodeResponse(call, obj.(runtime.Object), "deleted", nil)
		},
	})

	<-ctx.Done()
	return nil
}

func encodeResponse(call rpc.Call, obj runtime.Object, event string, err error) []byte {
	reply := map[string]interface{}{"id": call.ID}

	if err != nil {
		reply["error"] = err.Error()
	} else {
		var yaml bytes.Buffer
		printr := printers.NewTypeSetter(scheme.Scheme).ToPrinter(&printers.YAMLPrinter{})
		if err := printr.PrintObj(obj, &yaml); err != nil {
			reply["error"] = err.Error()
		}

		var json bytes.Buffer
		printr = printers.NewTypeSetter(scheme.Scheme).ToPrinter(&printers.JSONPrinter{})
		if err := printr.PrintObj(obj, &json); err != nil {
			reply["error"] = err.Error()
		}

		reply["result"] = map[string]string{
			"yaml":  yaml.String(),
			"json":  json.String(),
			"event": event,
		}
	}

	bytes, err := json.Marshal(reply)
	if err != nil {
		// Something really bad just happened.
		panic(err.Error())
	}
	return bytes
}
