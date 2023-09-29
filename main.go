package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"k8s.io/cli-runtime/pkg/genericclioptions"

	"github.com/iximiuz/kexp/api"
	restkubecontexts "github.com/iximiuz/kexp/api/rest/kube/contexts"
	restkubeobjects "github.com/iximiuz/kexp/api/rest/kube/objects"
	restkuberesources "github.com/iximiuz/kexp/api/rest/kube/resources"
	"github.com/iximiuz/kexp/api/stream"
	streamrpc "github.com/iximiuz/kexp/api/stream/rpc"
	streamkubeobjects "github.com/iximiuz/kexp/api/stream/rpc/kube/objects"
	"github.com/iximiuz/kexp/kubeclient"
)

var (
	version = "v0.0.0"
	commit  = "HEAD"
	date    = "unknown"

	versionString = fmt.Sprintf("%s (build: %s commit: %s)", version, date, commit)
)

type flagpole struct {
	*genericclioptions.ConfigFlags

	host string
	port string
}

// [--kubeconfig] [--namespace] [--context]
func main() {
	logrus.SetFormatter(&logrus.JSONFormatter{})
	logrus.SetLevel(logrus.TraceLevel)

	flags := flagpole{
		ConfigFlags: genericclioptions.NewConfigFlags(false), // false is import here!
	}

	cmd := &cobra.Command{
		Version: versionString,
		Use:     "kexp",
		Run:     run(&flags),
	}

	flags.AddFlags(cmd.PersistentFlags())
	cmd.PersistentFlags().StringVar(&flags.host, "host", "127.0.0.1", "Listening host")
	cmd.PersistentFlags().StringVar(&flags.port, "port", "5173", "Listening port")

	if err := cmd.Execute(); err != nil {
		logrus.WithError(err).Fatal("Command failed")
	}
}

//go:embed ui/dist/*
var uiStaticFS embed.FS

func run(flags *flagpole) func(cmd *cobra.Command, args []string) {
	return func(cmd *cobra.Command, args []string) {
		kubeClientPool, err := initKubeClientPoolWithRetry(cmd.Context(), flags, 300*time.Second)
		if err != nil {
			logrus.
				WithError(err).
				Fatal("Could not initialize Kubernetes client pool")
		}
		logrus.
			WithField("contexts", kubeClientPool.Contexts()).
			Debug("Kube context discovery finished")

		logrus.Infof("Starting server on %v:%v", flags.host, flags.port)

		router := gin.New()
		router.Use(gin.Logger())
		router.Use(api.MiddlewareRequestID)

		kubeContextsHandler := restkubecontexts.NewHandler(
			kubeClientPool,
			logrus.NewEntry(logrus.StandardLogger()),
		)
		kubeContextsv1 := router.Group("/api/kube/v1/contexts")
		kubeContextsv1.GET("/", kubeContextsHandler.List)

		kubeResourcesHandler := restkuberesources.NewHandler(
			kubeClientPool,
			logrus.NewEntry(logrus.StandardLogger()),
		)
		kubeResourcesv1 := router.Group("/api/kube/v1/contexts/:ctx/resources")
		kubeResourcesv1.GET("/", kubeResourcesHandler.List)

		kubeObjectsHandler := restkubeobjects.NewHandler(
			kubeClientPool,
			logrus.NewEntry(logrus.StandardLogger()),
		)
		kubeObjectsv1 := router.Group("/api/kube/v1/contexts/:ctx/resources")
		kubeObjectsv1.GET("/:group/:version/:resource/", kubeObjectsHandler.List)
		kubeObjectsv1.GET("/:group/:version/namespaces/:namespace/:resource/", kubeObjectsHandler.List)
		kubeObjectsv1.GET("/:group/:version/:resource/:name/", kubeObjectsHandler.Get)
		kubeObjectsv1.GET("/:group/:version/namespaces/:namespace/:resource/:name/", kubeObjectsHandler.Get)
		kubeObjectsv1.PUT("/:group/:version/:resource/:name/", kubeObjectsHandler.Update)
		kubeObjectsv1.PUT("/:group/:version/namespaces/:namespace/:resource/:name/", kubeObjectsHandler.Update)
		kubeObjectsv1.DELETE("/:group/:version/:resource/:name/", kubeObjectsHandler.Delete)
		kubeObjectsv1.DELETE("/:group/:version/namespaces/:namespace/:resource/:name/", kubeObjectsHandler.Delete)

		rpcCallDispatcher := streamrpc.NewCallDispatcher()
		rpcCallDispatcher.RegisterCallHandler(
			streamkubeobjects.Watch,
			streamkubeobjects.NewWatchHandler(kubeClientPool),
		)
		streamHandler := stream.NewHandler(logrus.NewEntry(logrus.StandardLogger()))
		streamHandler.RegisterMessageHandler(streamrpc.MessageTypeCall, rpcCallDispatcher)
		streamv1 := router.Group("/api/stream/v1")
		streamv1.GET("/", streamHandler.Connect)

		if uiStaticFS, err := fs.Sub(uiStaticFS, "ui/dist"); err != nil {
			logrus.WithError(err).Fatal("Could not load static files")
		} else {
			router.StaticFS("/ui", http.FS(uiStaticFS))

			router.GET("/", func(c *gin.Context) {
				c.Redirect(http.StatusMovedPermanently, "/ui")
			})
		}

		if err := router.Run(flags.host + ":" + flags.port); err != nil {
			logrus.WithError(err).Fatal("Router failed")
		}
	}
}

func initKubeClientPool(ctx context.Context, flags *flagpole) (*kubeclient.ClientPool, error) {
	rawConfig, err := flags.ToRawKubeConfigLoader().RawConfig()
	if err != nil {
		return nil, err
	}

	curKubeCtx := *flags.Context
	if curKubeCtx == "" {
		curKubeCtx = rawConfig.CurrentContext
	}

	pool := kubeclient.NewPool()
	for name, kctx := range rawConfig.Contexts {
		// TODO: This might be an overkill.
		// TODO: Restore the original flags.Context value.
		flags.Context = &name
		config, err := flags.ToRawKubeConfigLoader().ClientConfig()
		if err != nil {
			logrus.
				WithField("context", name).
				WithError(err).
				Warnf("couldn't load REST config for a context")
			if name == curKubeCtx {
				curKubeCtx = ""
			}
			continue
		}

		if err := pool.Add(ctx, name, kctx.AuthInfo, kctx.Cluster, kctx.Namespace, config); err != nil {
			logrus.
				WithField("context", name).
				WithError(err).
				Warnf("couldn't add a context to the pool")
			if name == curKubeCtx {
				curKubeCtx = ""
			}
			continue
		}
	}

	if len(pool.Contexts()) == 0 {
		return nil, fmt.Errorf("no functional contexts found")
	}

	if curKubeCtx != "" {
		if err := pool.SetCurrent(curKubeCtx); err != nil {
			return nil, err
		}
	}

	return pool, nil
}

func initKubeClientPoolWithRetry(
	ctx context.Context,
	flags *flagpole,
	maxWait time.Duration,
) (pool *kubeclient.ClientPool, err error) {
	startAt := time.Now()

	for time.Since(startAt) < maxWait {
		pool, err = initKubeClientPool(ctx, flags)
		if err == nil {
			return pool, nil
		}

		time.Sleep(1 * time.Second)
	}

	return nil, err
}
