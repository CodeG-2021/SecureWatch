# ADR-0002: Technical Foundation

## Status

Accepted.

## Context

SecureWatch must run locally with Docker, process evidence asynchronously, support specialized workers, persist traceability, and remain understandable as a portfolio-grade distributed system.

## Decision

Use the following technical foundation for the MVP:

- React, TypeScript, Tailwind CSS, shadcn/ui, and TanStack Query for the web application.
- Go for backend services.
- Python for specialized processing workers.
- PostgreSQL for metadata, states, findings, reports, notifications, and audit logs.
- MinIO for evidence files, processed artifacts, transcripts, extracted text, and generated reports.
- RabbitMQ for asynchronous task dispatch, retries, and dead-letter handling.
- HTTP JSON for synchronous service-to-service communication.
- SSE or WebSockets for real-time dashboard updates.
- Prometheus and Grafana for local observability.
- Docker Compose for local reproducible execution.

## Consequences

- Backend services can stay small and focused around clear responsibilities.
- Workers can scale horizontally without coupling processing logic to the API path.
- File storage remains separate from metadata and relational traceability.
- RabbitMQ introduces operational complexity, but it makes asynchronous processing and retry behavior explicit.
- The API Gateway becomes the stable external entry point for the frontend.
- Future connectors can publish evidence-created events without changing worker contracts.

## Follow-up Decisions

The following decisions should be made when implementation starts:

- Go HTTP framework: Chi, Gin, or Fiber.
- Migration tool: goose, migrate, or service-owned migration runner.
- Real-time transport: SSE or WebSockets.
- Worker dependency strategy for heavy libraries such as Whisper, OpenCV, and NLP models.
- Report generation library and PDF layout strategy.
