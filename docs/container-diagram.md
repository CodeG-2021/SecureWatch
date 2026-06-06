# SecureWatch Container Diagram

This diagram describes the main SecureWatch runtime containers for the MVP. It focuses on local Docker execution, service boundaries, data stores, messaging, and observability.

```mermaid
flowchart TB
  User["User\nAdministrator / Analyst / Supervisor"]

  subgraph Client["Client"]
    Web["Web App\nReact + TypeScript\nTailwind + shadcn/ui"]
  end

  subgraph Backend["Backend Services - Go"]
    Gateway["API Gateway\nHTTP API + Auth Middleware\nSSE/WebSocket events"]
    Auth["Auth Service\nUsers, roles, JWT"]
    Case["Case Service\nCases and lifecycle"]
    Evidence["Evidence Service\nUpload, validation, hashing"]
    Orchestrator["Task Orchestrator\nClassification and task dispatch"]
    Report["Report Service\nConsolidated PDF reports"]
    Notification["Notification Service\nInternal alerts"]
  end

  subgraph Workers["Processing Workers - Python"]
    TextWorker["Text Worker\nText and transcript analysis"]
    DocumentWorker["Document Worker\nPDF/document text extraction"]
    ImageWorker["Image Worker\nImage labels and risk signals"]
    AudioWorker["Audio Worker\nAudio transcription"]
  end

  subgraph Infrastructure["Local Infrastructure - Docker Compose"]
    Postgres[("PostgreSQL\nMetadata, states, audit trail")]
    RabbitMQ[("RabbitMQ\nTask queues + DLQ")]
    MinIO[("MinIO\nEvidence and reports")]
    Prometheus["Prometheus\nMetrics scraping"]
    Grafana["Grafana\nDashboards"]
  end

  User --> Web
  Web -->|"HTTPS/HTTP + JSON"| Gateway
  Gateway -. "SSE/WebSocket status updates" .-> Web

  Gateway --> Auth
  Gateway --> Case
  Gateway --> Evidence
  Gateway --> Report
  Gateway --> Notification

  Auth --> Postgres
  Case --> Postgres
  Evidence --> Postgres
  Evidence --> MinIO
  Evidence --> Orchestrator

  Orchestrator --> Postgres
  Orchestrator --> RabbitMQ

  RabbitMQ --> TextWorker
  RabbitMQ --> DocumentWorker
  RabbitMQ --> ImageWorker
  RabbitMQ --> AudioWorker

  TextWorker --> Postgres
  TextWorker --> MinIO
  DocumentWorker --> Postgres
  DocumentWorker --> MinIO
  DocumentWorker --> RabbitMQ
  ImageWorker --> Postgres
  ImageWorker --> MinIO
  AudioWorker --> Postgres
  AudioWorker --> MinIO
  AudioWorker --> RabbitMQ

  Report --> Postgres
  Report --> MinIO
  Notification --> Postgres

  Gateway --> Prometheus
  Auth --> Prometheus
  Case --> Prometheus
  Evidence --> Prometheus
  Orchestrator --> Prometheus
  Report --> Prometheus
  Notification --> Prometheus
  TextWorker --> Prometheus
  DocumentWorker --> Prometheus
  ImageWorker --> Prometheus
  AudioWorker --> Prometheus
  Prometheus --> Grafana
```

## Container Responsibilities

| Container | Runtime | Responsibility |
| --- | --- | --- |
| Web App | React + TypeScript | User interface for authentication, case management, evidence upload, dashboard, findings, and reports. |
| API Gateway | Go | Central API entry point, routing, CORS, authentication middleware, request logging, and real-time updates. |
| Auth Service | Go | User registration, sign-in, role management, JWT issuing, and authorization support. |
| Case Service | Go | Case creation, listing, filtering, detail view, updates, status changes, and audit events. |
| Evidence Service | Go | Multipart upload, file validation, SHA-256 hashing, MinIO storage, and metadata persistence. |
| Task Orchestrator | Go | Evidence classification, task creation, RabbitMQ publishing, retries, and dead-letter handling. |
| Text Worker | Python | Text normalization, keyword/category detection, severity calculation, and finding registration. |
| Document Worker | Python | PDF/document text extraction and secondary text-analysis task creation. |
| Image Worker | Python | Basic image analysis, label detection, risk signal detection, and finding registration. |
| Audio Worker | Python | Audio transcription and secondary text-analysis task creation. |
| Report Service | Go | Consolidated report generation, PDF storage, and report metadata management. |
| Notification Service | Go | Internal alerts for high or critical findings and notification state management. |
| PostgreSQL | Database | Persistent metadata, users, cases, evidence, tasks, findings, reports, notifications, and audit logs. |
| RabbitMQ | Message broker | Asynchronous task queues, routing by task type, retries, and dead-letter queue. |
| MinIO | Object storage | Original evidence files, processed artifacts, transcripts, extracted text, and generated reports. |
| Prometheus | Observability | Metrics scraping for services and workers. |
| Grafana | Observability | Dashboards for application and infrastructure metrics. |

## Local Docker Scope

For the MVP, every runtime container should be runnable locally through Docker Compose. Infrastructure containers already exist in the base Compose file. Application containers should be added as each service, worker, and frontend workspace is implemented.

## Related Flows

- [Evidence upload, RabbitMQ processing, and report generation](architecture-flows.md)
- [Service communication rules](service-communication.md)
