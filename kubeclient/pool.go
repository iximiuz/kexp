package kubeclient

import (
	"context"
	"errors"
	"fmt"
	"sync"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	_ "k8s.io/client-go/plugin/pkg/client/auth"
)

var errUnknownContext = errors.New("unknown context")

type ClientPool struct {
	mux sync.RWMutex

	contexts map[string]*Context
	current  *Context
}

func NewPool() *ClientPool {
	return &ClientPool{
		contexts: make(map[string]*Context),
	}
}

func (p *ClientPool) Add(
	ctx context.Context,
	context string,
	user string,
	cluster string,
	namespace string,
	config *rest.Config,
) error {
	p.mux.Lock()
	defer p.mux.Unlock()

	kctx := &Context{
		name:      context,
		user:      user,
		cluster:   cluster,
		namespace: namespace,
		config:    config,
	}

	client, err := kctx.DynamicClient()
	if err != nil {
		return fmt.Errorf("couldn't create dynamic client for given config: %w", err)
	}

	ns, err := client.Resource(schema.GroupVersionResource{
		Group:    "",
		Version:  "v1",
		Resource: "namespaces",
	}).Get(ctx, "kube-system", metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("couldn't get kube-system ns: %w", err)
	}

	kctx.clusterUID = string(ns.GetUID())

	p.contexts[kctx.name] = kctx

	// First added becomes default (until it's explicitly overriden).
	if p.current == nil {
		p.current = kctx
	}

	return nil
}

func (p *ClientPool) SetCurrent(name string) error {
	p.mux.Lock()
	defer p.mux.Unlock()

	if c, found := p.contexts[name]; found {
		p.current = c
		return nil
	}

	return errUnknownContext
}

func (p *ClientPool) CurrentContext() *Context {
	return p.current
}

func (p *ClientPool) Context(name string) (*Context, error) {
	p.mux.RLock()
	defer p.mux.RUnlock()

	if c, found := p.contexts[name]; found {
		return c, nil
	}

	return nil, errUnknownContext
}

func (p *ClientPool) Contexts() (cs []*Context) {
	p.mux.RLock()
	defer p.mux.RUnlock()

	for _, c := range p.contexts {
		cs = append(cs, c)
	}
	return
}

type Context struct {
	mux sync.RWMutex

	// Attrs from the kubeconfig struct.

	// Name must be unique per kubeconfig file.
	name string

	// Cluster name must be unique per kubeconfig file
	// but cluster entries with different names can point
	// to the same cluster.
	cluster string

	// Unique ID for the cluster because multiple contexts
	// can point to the same cluster known under different
	// names. Since there's no unique cluster ID in Kubernetes,
	// UID of the kube-system namespace is used as a substitute.
	clusterUID string

	user string

	namespace string

	config *rest.Config

	discoveryClient discovery.DiscoveryInterface
	dynamicClient   dynamic.Interface
}

func (c *Context) Name() string {
	return c.name
}

func (c *Context) User() string {
	return c.user
}

func (c *Context) Cluster() string {
	return c.cluster
}

func (c *Context) ClusterUID() string {
	return c.clusterUID
}

func (c *Context) Namespace() string {
	return c.namespace
}

func (c *Context) DiscoveryClient() (discovery.DiscoveryInterface, error) {
	c.mux.Lock()
	defer c.mux.Unlock()

	if c.discoveryClient == nil {
		client, err := discovery.NewDiscoveryClientForConfig(c.config)
		if err != nil {
			return nil, fmt.Errorf("couldn't create discovery client for given config: %w", err)
		}
		c.discoveryClient = client
	}

	return c.discoveryClient, nil
}

func (c *Context) DynamicClient() (dynamic.Interface, error) {
	c.mux.Lock()
	defer c.mux.Unlock()

	if c.dynamicClient == nil {
		client, err := dynamic.NewForConfig(c.config)
		if err != nil {
			return nil, fmt.Errorf("couldn't create dynamic client for given config: %w", err)
		}
		c.dynamicClient = client
	}

	return c.dynamicClient, nil
}
