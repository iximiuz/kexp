CUR_DIR := $(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))

VERSION=v0.0.0
GIT_COMMIT=$(shell git rev-parse --verify HEAD)
UTC_NOW=$(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

.PHONY: back-run-dev
back-run-dev:
	go run ${CUR_DIR}/main.go --host 0.0.0.0

.PHONY: back-fmt
back-fmt:
	cd ${CUR_DIR} && go fmt ./...

.PHONY: back-lint
back-lint: back-fmt
	golangci-lint run

.PHONY: front-run-dev
front-run-dev:
	cd ${CUR_DIR}/ui && npm run dev

.PHONY: front-lint-fix
front-lint-fix:
	cd ${CUR_DIR}/ui && npm run lint-fix

.PHONY: front-build
front-build:
	cd ${CUR_DIR}/ui && npm run build

.PHONY: build-dev
build-dev:
	cd ${CUR_DIR}/ui && npm run build
	go build -o ${CUR_DIR}/bin/kexp ${CUR_DIR}/main.go
	CGO_ENABLED=0 go build \
		-ldflags "-X main.version=${VERSION} -X main.commit=${GIT_COMMIT} -X main.date=${UTC_NOW}" \
		-o ${CUR_DIR}/bin/kexp main.go

.PHONY: release
release:
	goreleaser --clean

.PHONY: release-snapshot
release-snapshot:
	goreleaser release --snapshot --clean
