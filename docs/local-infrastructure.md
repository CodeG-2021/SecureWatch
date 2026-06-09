# Local Infrastructure

SecureWatch local infrastructure is managed with Docker Compose. This document maps the HU-02 technical tasks to the implemented local setup.

## Services

| Task | Service | Compose Service | Local URL / Port |
| --- | --- | --- | --- |
| HU-04-T08 | Web App | `web` | `localhost:3000` |
| HU-03 | API Gateway | `api-gateway` | `localhost:8080` |
| HU-02-T01 | PostgreSQL | `postgres` | `localhost:5432` |
| HU-02-T02 | RabbitMQ | `rabbitmq` | AMQP `localhost:5672`, Management UI `localhost:15672` |
| HU-02-T03 | MinIO | `minio` | API `localhost:9000`, Console `localhost:9001` |
| HU-02-T04 | Prometheus | `prometheus` | `localhost:9090` |
| HU-02-T05 | Grafana | `grafana` | `localhost:3001` |

## Networks

HU-02-T06 is implemented with the Docker network `securewatch-local`. All infrastructure containers join this network and can communicate by Compose service name.

Examples:

- `postgres:5432`
- `web:80`
- `api-gateway:8080`
- `rabbitmq:5672`
- `minio:9000`
- `prometheus:9090`
- `grafana:3000`

## Persistent Volumes

HU-02-T07 is implemented with named Docker volumes:

- `postgres_data`
- `rabbitmq_data`
- `minio_data`
- `prometheus_data`
- `grafana_data`

These volumes preserve local state across container restarts.

## RabbitMQ Definitions

RabbitMQ loads definitions from:

[infra/docker/rabbitmq/definitions.json](../infra/docker/rabbitmq/definitions.json)

Configured exchanges:

- `securewatch.tasks`
- `securewatch.events`
- `securewatch.dlx`

Configured queues:

- `tasks.text`
- `tasks.document`
- `tasks.image`
- `tasks.audio`
- `tasks.dead_letter`

## MinIO Buckets

The `minio-init` one-shot container creates private buckets:

- `securewatch-evidence`
- `securewatch-reports`
- `securewatch-artifacts`

Bucket names can be changed through `.env`.

## Grafana Provisioning

Grafana loads:

- Prometheus datasource from [infra/docker/grafana/provisioning/datasources/datasource.yml](../infra/docker/grafana/provisioning/datasources/datasource.yml)
- Dashboard provider from [infra/docker/grafana/provisioning/dashboards/dashboard.yml](../infra/docker/grafana/provisioning/dashboards/dashboard.yml)
- Initial dashboard from [infra/docker/grafana/dashboards/securewatch-overview.json](../infra/docker/grafana/dashboards/securewatch-overview.json)

## Connection Test

HU-02-T08 is implemented with:

```bash
make check-infra
```

The check validates:

- Containers are running.
- PostgreSQL accepts connections.
- RabbitMQ responds to diagnostics ping.
- MinIO is ready.
- Prometheus health endpoint is reachable.
- Grafana health endpoint is reachable.

## Usage

```bash
cp .env.example .env
make up
make check-infra
make check-api-gateway
```
