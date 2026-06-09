# SecureWatch

SecureWatch is an open source platform for distributed digital evidence analysis. The monorepo is organized to support a decoupled architecture with a web frontend, Go backend services, specialized Python workers, RabbitMQ, PostgreSQL, MinIO, and observability with Prometheus/Grafana.

## Structure

```text
apps/
  web/                         React + TypeScript frontend.
services/
  api-gateway/                 HTTP/SSE entry point for the frontend.
  auth-service/                Users, roles, JWT, and authorization.
  case-service/                Cases, related evidence, and case states.
  evidence-service/            Evidence upload, validation, hash, and metadata.
  task-orchestrator/           Classification, task creation, and RabbitMQ.
  report-service/              Consolidated case reports.
  notification-service/        Internal alerts for relevant findings.
workers/
  text-worker/                 Text and transcript analysis.
  document-worker/             Text extraction from PDFs/documents.
  image-worker/                Basic image analysis.
  audio-worker/                Transcription and handoff to text analysis.
packages/
  contracts/                   Shared events, DTOs, and contracts.
  shared-go/                   Common utilities for Go services.
  shared-python/               Common utilities for Python workers.
infra/
  docker/                      Local infrastructure configuration.
  database/                    Migrations and seed data.
  rabbitmq/                    Exchange, queue, and DLQ definitions.
  observability/               Dashboards, metrics, and traces.
docs/
  architecture.md              Architecture and initial flow.
  roadmap.md                   Roadmap based on the requirements stories.
scripts/
  load-tests/                  Load testing scripts.
```

## Local Infrastructure

1. Copy `.env.example` to `.env` and adjust local credentials if needed.
2. Start dependencies:

```bash
make up
```

3. Verify local infrastructure connectivity:

```bash
make check-infra
```

Default local services:

- Web App: `localhost:3000`
- API Gateway: `localhost:8080`
- PostgreSQL: `localhost:5432`
- RabbitMQ: `localhost:15672`
- MinIO: `localhost:9001`
- Prometheus: `localhost:9090`
- Grafana: `localhost:3001`

## First Milestones

- HU-00: initialize the monorepo, local environment, and conventions.
- HU-01: document the base architecture, communication patterns, and events.
- HU-02: validate local infrastructure with Docker Compose.
- HU-03: create the API Gateway with health checks, CORS, logs, and auth middleware.

## Conventions

- [Commit Convention](docs/commit-convention.md)
- [Container Diagram](docs/container-diagram.md)
- [Architecture Flows](docs/architecture-flows.md)
- [Service Communication](docs/service-communication.md)
- [Technical Foundation ADR](docs/decisions/ADR-0002-technical-foundation.md)
- [Local Infrastructure](docs/local-infrastructure.md)
- [API Gateway Endpoints](docs/api-gateway-endpoints.md)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 Greivin Gonzalez Villalobos (CodeG).
