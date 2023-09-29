# syntax=docker/dockerfile:1

# Build stage
FROM golang:1.20 as build

ARG BUILD_VERSION=v0.0.0
ARG BUILD_COMMIT=HEAD
ARG BUILD_DATE=unknown

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 go build \
  -ldflags "-X main.version=${BUILD_VERSION} -X main.commit=${BUILD_COMMIT} -X main.date=${BUILD_DATE}" \
  -o bin/kexp main.go

# App stage
FROM alpine:3.18

COPY --from=build /src/bin/kexp /usr/local/bin/kexp

EXPOSE 5173

CMD ["kexp", "--host", "127.0.0.1", "--port", "5173"]
