# SecureWatch — Architecture

SecureWatch is a distributed platform for receiving, managing, processing, monitoring, and reporting on digital evidence. The architecture separates the user interface, domain services, asynchronous orchestration, specialized workers, and supporting infrastructure into independent, replaceable components.

---

## Design Principles

- **Single responsibility per service** — each service owns a bounded domain and its data.
- **Asynchronous processing** — workers consume tasks from RabbitMQ queues; the upload path is never blocked by processing.
- **Horizontally scalable workers** — workers are stateless; multiple instances can consume the same queue.
- **Full traceability** — every evidence file has a chain: upload → task → worker → findings → report.
- **Immutable audit trail** — every user-initiated action is recorded in `audit_events` with actor, IP, and timestamp.
- **Real-time feedback** — SSE streams push evidence status, findings, and notifications to the browser without polling.
- **Reproducible local environment** — the full stack runs with `make up` via Docker Compose.

---

## System Overview

```mermaid
flowchart TB
  subgraph Client["Client Layer"]
    Web["Web App\nReact + TypeScript\n:3000"]
  end

  subgraph API["API Layer"]
    GW["API Gateway\nGo · Chi\n:8080"]
  end

  subgraph Domain["Domain Services (Go)"]
    Auth["Auth Service\n:8081\nUsers · Roles · JWT"]
    Case["Case Service\n:8082\nCases · Findings · Notifications\nReports · Audit"]
    Ev["Evidence Service\n:8083\nUpload · Validate · Hash\nMinIO · Task Dispatch"]
  end

  subgraph Async["Async Layer"]
    TO["Task Orchestrator\nGo\nClassify · Queue"]
    MQ[("RabbitMQ\nTask queues · DLQ")]
  end

  subgraph Workers["Processing Workers (Python)"]
    TW["Text Worker"]
    DW["Document Worker"]
    IW["Image Worker"]
    AW["Audio Worker"]
    ARW["Archive Worker"]
  end

  subgraph Storage["Persistence"]
    PG[("PostgreSQL 16\nMetadata · State · Audit")]
    S3[("MinIO\nFiles · Artifacts · Reports")]
  end

  subgraph Obs["Observability"]
    Prom["Prometheus\n:9090"]
    Graf["Grafana\n:3001"]
  end

  Web -->|"HTTP/JSON + JWT"| GW
  GW -.->|"SSE events"| Web
  GW --> Auth & Case & Ev

  Auth --> PG
  Case --> PG
  Ev --> PG & S3
  Ev --> TO

  TO --> PG & MQ

  MQ --> TW & DW & IW & AW & ARW
  TW & DW & IW & AW & ARW --> PG & S3
  DW & AW -->|"chain tasks"| MQ

  GW & Auth & Case & Ev --> Prom
  Prom --> Graf
```

---

## Main Flow

```mermaid
sequenceDiagram
  actor User
  participant Web
  participant GW as API Gateway
  participant Case as Case Service
  participant Ev as Evidence Service
  participant PG as PostgreSQL
  participant S3 as MinIO
  participant TO as Task Orchestrator
  participant MQ as RabbitMQ
  participant W as Worker
  participant SSE as SSE Stream

  User->>Web: Create case
  Web->>GW: POST /api/v1/cases
  GW->>Case: Create case
  Case->>PG: INSERT cases
  Case-->>GW: Case created
  GW-->>Web: Case metadata

  User->>Web: Upload evidence
  Web->>GW: POST /api/v1/cases/{id}/evidences
  GW->>Ev: Forward multipart
  Ev->>Ev: Validate + SHA-256 hash
  Ev->>S3: Store original file
  Ev->>PG: INSERT evidences (status=uploaded)
  Ev->>TO: Notify new evidence
  Ev-->>GW: Evidence metadata
  GW-->>Web: Evidence created
  GW->>SSE: event: evidence_updated

  TO->>PG: Classify → INSERT tasks
  TO->>MQ: Publish task message

  MQ->>W: Deliver task
  W->>S3: Download file
  W->>W: Process
  W->>PG: INSERT findings
  W->>PG: UPDATE tasks (completed)
  W->>PG: UPDATE evidences (completed)
  W->>PG: pg_notify securewatch_events
  GW->>SSE: event: finding_created / evidence_updated

  User->>Web: Generate report
  Web->>GW: POST /api/v1/cases/{id}/report
  GW->>Ev: Generate report
  Ev->>PG: Load case + evidence + findings
  Ev->>S3: Store PDF
  Ev->>PG: INSERT reports
  Ev-->>GW: Report metadata
  GW-->>Web: Report ready
```

---

## Real-Time Events (SSE)

The API Gateway exposes a Server-Sent Events stream per case:

```
GET /api/v1/cases/{caseId}/stream?token=<jwt>
```

PostgreSQL `NOTIFY` on the `securewatch_events` channel propagates events from workers to the gateway, which fans them out to connected browser clients.

| Event type | Trigger |
|---|---|
| `evidence_updated` | Evidence status changes (uploaded → processing → completed) |
| `finding_created` | Worker registers a new finding |
| `task_updated` | Task status changes |
| `notification` | High or critical finding detected |

---

## Authentication & Authorization

All protected endpoints require `Authorization: Bearer <jwt>`.

The API Gateway validates the JWT and injects decoded claims into the `X-User-*` headers forwarded to internal services.

| Role | Permissions |
|---|---|
| `admin` | Full access including user management and audit log |
| `supervisor` | Cases, evidence, reports, audit log (read) |
| `analyst` | Cases and evidence for assigned cases |

---

## Component Responsibilities

| Component | Language | Responsibility |
|---|---|---|
| Web App | React + TypeScript | UI: auth, cases, evidence, findings, reports, notifications, audit |
| API Gateway | Go | Routing, auth middleware, CORS, SSE, reverse proxy, metrics |
| Auth Service | Go | User registration, login, role management, JWT |
| Case Service | Go | Cases, findings, notifications, audit events, reports |
| Evidence Service | Go | Upload, validation, hashing, MinIO, task dispatch |
| Task Orchestrator | Go | Classification, task creation, RabbitMQ publishing |
| Text Worker | Python | Keyword extraction, entity detection, risk scoring |
| Document Worker | Python | PDF/Office text extraction → chains to text worker |
| Image Worker | Python | Object detection, EXIF metadata extraction |
| Audio Worker | Python | Whisper transcription → chains to text worker |
| Archive Worker | Python | Archive contents inspection, suspicious file detection |

---

## Related Documents

- [Container Diagram](container-diagram.md) — detailed C4 container view
- [Architecture Flows](architecture-flows.md) — upload, processing, report sequence diagrams
- [Service Communication](service-communication.md) — communication patterns and rules
- [Database Schema](database-schema.md) — all tables and relationships
- [Workers](workers.md) — worker pipeline and task types
