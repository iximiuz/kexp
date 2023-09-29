# k'exp - Kubernetes Explorer

Understand Kubernetes - the visual way.
Not yet another attempt to manage production clusters in the browser.

k'exp is for:

- Learning and exploring Kubernetes capabilities
- Application development (object graph "presets" for every app)
- Controller and operator development (dynamic object graph)
- [coming soon] Postman-like client for Kubernetes API


## How to run

It's a single Go binary with embedded UI.
If you already have `kubectl` configured to access your cluster(s),
you can run `kexp` too - it uses the same `KUBECONFIG` discovery logic.

```sh
```


## Development

Server:

```sh
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

Client:

```sh
cd ui
npm install
npm run dev
```

```sh
make front-run-dev
make back-run-dev

open localhost:5173
```
