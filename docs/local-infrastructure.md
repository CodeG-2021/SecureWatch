# SecureWatch — Local Infrastructure

Local infrastructure is managed with Docker Compose. Everything starts with `make up`.

## Services

| Service | Compose Name | Local URL / Port |
|---|---|---|
| Web App | `web` | `localhost:3000` |
| API Gateway | `api-gateway` | `localhost:8080` |
| Auth Service | `auth-service` | `localhost:8081` |
| Case Service | `case-service` | `localhost:8082` |
| Evidence Service | `evidence-service` | `localhost:8083` |
| PostgreSQL | `postgres` | `localhost:5432` |
| RabbitMQ AMQP | `rabbitmq` | `localhost:5672` |
| RabbitMQ Management | `rabbitmq` | `localhost:15672` |
| MinIO API | `minio` | `localhost:9000` |
| MinIO Console | `minio` | `localhost:9001` |
| Prometheus | `prometheus` | `localhost:9090` |
| Grafana | `grafana` | `localhost:3001` |

## Networks

All containers join the Docker network `securewatch-local` and communicate by Compose service name:

- `postgres:5432`
- `rabbitmq:5672`
- `minio:9000`
- `api-gateway:8080`

## Persistent Volumes

Named Docker volumes preserve local state across restarts:

- `postgres_data`
- `rabbitmq_data`
- `minio_data`
- `prometheus_data`
- `grafana_data`

## RabbitMQ Definitions

RabbitMQ loads definitions from [`infra/docker/rabbitmq/definitions.json`](../infra/docker/rabbitmq/definitions.json).

Exchanges:
- `securewatch.tasks`
- `securewatch.events`
- `securewatch.dlx`

Queues:
- `tasks.text`
- `tasks.document`
- `tasks.image`
- `tasks.audio`
- `tasks.archive`
- `tasks.dead_letter`

## MinIO Buckets

The `minio-init` one-shot container creates private buckets on first run:

- `securewatch-evidence`
- `securewatch-reports`
- `securewatch-artifacts`

Bucket names can be changed via `.env`.

## Grafana Provisioning

Grafana automatically loads:

- Prometheus datasource: [`infra/docker/grafana/provisioning/datasources/datasource.yml`](../infra/docker/grafana/provisioning/datasources/datasource.yml)
- Dashboard provider: [`infra/docker/grafana/provisioning/dashboards/dashboard.yml`](../infra/docker/grafana/provisioning/dashboards/dashboard.yml)
- Overview dashboard: [`infra/docker/grafana/dashboards/securewatch-overview.json`](../infra/docker/grafana/dashboards/securewatch-overview.json)

## Connectivity Check

```bash
make check-infra
```

Validates that PostgreSQL, RabbitMQ, MinIO, Prometheus, and Grafana are all reachable.

## Usage

```bash
cp .env.example .env
make up
make check-infra
make check-api-gateway
```
