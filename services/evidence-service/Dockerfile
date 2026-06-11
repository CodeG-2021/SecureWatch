FROM golang:1.23-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=0 GOOS=linux go build -o /out/evidence-service ./cmd/evidence-service

FROM alpine:3.21

RUN addgroup -S securewatch && adduser -S securewatch -G securewatch

USER securewatch
WORKDIR /app

COPY --from=build /out/evidence-service /app/evidence-service

EXPOSE 8083

ENTRYPOINT ["/app/evidence-service"]
