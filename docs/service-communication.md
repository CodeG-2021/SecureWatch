# Service Communication

SecureWatch uses a small set of communication patterns to keep services decoupled while preserving traceability.

## Communication Types

| Pattern | Used For | Transport | Notes |
| --- | --- | --- | --- |
| Frontend to backend | User actions and dashboard reads | HTTP JSON, multipart uploads, SSE/WebSocket | All frontend traffic enters through the API Gateway. |
| Service to service | Synchronous validation or data lookup | Internal HTTP JSON | Use when the caller needs an immediate answer. |
| Task dispatch | Asynchronous evidence processing | RabbitMQ | Task messages contain identifiers, not full files. |
| Domain events | Dashboard, audit, notifications, and state propagation | RabbitMQ events exchange | Events are append-only facts about something that already happened. |
| Object access | Evidence, artifacts, transcripts, reports | MinIO S3-compatible API | Services store object keys in PostgreSQL. |
| Persistence | Metadata, states, results, traceability | PostgreSQL | Each service should own its write model where practical. |
| Observability | Metrics scraping | Prometheus HTTP scraping | Services and workers should expose `/metrics` when implemented. |

## API Gateway Rules

- The Web App must not call internal services directly.
- The API Gateway validates authentication and forwards user context to downstream services.
- The API Gateway should expose a stable external API even if internal service APIs evolve.
- Real-time user-facing updates should be exposed by the API Gateway through SSE or WebSockets.

## Internal HTTP Rules

- Internal APIs should use JSON request and response bodies.
- Every request should include a request ID.
- User-initiated internal calls should include user context from the API Gateway.
- Services should return typed error responses with stable error codes.
- Internal calls should have explicit timeouts and structured logs.

## RabbitMQ Rules

- `securewatch.tasks` is for commands that workers must process.
- `securewatch.events` is for facts that other components can react to.
- `securewatch.dlx` is for exhausted task messages.
- Task messages should include `task_id`, `case_id`, `evidence_id`, `task_type`, `priority`, `retry_count`, and `trace_id`.
- Events should include `event_id`, `event_type`, `occurred_at`, `producer`, `aggregate_type`, `aggregate_id`, and `payload`.

## Data Ownership

| Data | Owner | Shared Through |
| --- | --- | --- |
| Users and roles | Auth Service | API Gateway and internal HTTP |
| Cases | Case Service | Internal HTTP and read queries |
| Evidence metadata | Evidence Service | PostgreSQL references and events |
| Files and artifacts | Evidence Service / Workers / Report Service | MinIO object keys |
| Tasks | Task Orchestrator | RabbitMQ messages and PostgreSQL states |
| Findings | Workers or internal findings endpoint | PostgreSQL and `finding.created` events |
| Reports | Report Service | PostgreSQL metadata and MinIO objects |
| Notifications | Notification Service | PostgreSQL and dashboard events |
| Audit logs | Audit middleware or owning services | PostgreSQL |
