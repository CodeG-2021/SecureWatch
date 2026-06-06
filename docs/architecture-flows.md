# SecureWatch Architecture Flows

This document defines the core MVP flows for evidence upload, RabbitMQ processing, and report generation.

## Evidence Upload Flow

```mermaid
sequenceDiagram
  autonumber
  actor Analyst
  participant Web as Web App
  participant Gateway as API Gateway
  participant Auth as Auth Service
  participant Case as Case Service
  participant Evidence as Evidence Service
  participant MinIO as MinIO
  participant DB as PostgreSQL
  participant Orchestrator as Task Orchestrator
  participant Events as securewatch.events

  Analyst->>Web: Select case and upload files
  Web->>Gateway: POST /cases/{caseId}/evidences multipart/form-data
  Gateway->>Auth: Validate JWT and role
  Auth-->>Gateway: Authorized user context
  Gateway->>Case: Validate case exists and is editable
  Case-->>Gateway: Case metadata
  Gateway->>Evidence: Forward upload request
  Evidence->>Evidence: Validate file size, extension, MIME type, and empty content
  Evidence->>Evidence: Calculate SHA-256 hash
  Evidence->>DB: Check duplicate hash for the case
  DB-->>Evidence: Duplicate status
  Evidence->>MinIO: Store original file
  MinIO-->>Evidence: Object key and version metadata
  Evidence->>DB: Insert evidence metadata with status uploaded
  Evidence->>Events: Publish evidence.uploaded
  Evidence->>Orchestrator: Notify new evidence for classification
  Orchestrator->>DB: Classify evidence and update status classified
  Orchestrator->>Events: Publish evidence.classified
  Evidence-->>Gateway: Evidence upload response
  Gateway-->>Web: Evidence metadata and initial status
  Web-->>Analyst: Show uploaded evidence in the case
```

### Upload Rules

- The API Gateway authenticates the request and forwards the user context to internal services.
- Evidence Service owns file validation, hashing, object storage, and evidence metadata.
- Original evidence files are never stored in service containers.
- MinIO stores original files under deterministic object keys that include `case_id` and `evidence_id`.
- PostgreSQL stores metadata, states, hashes, and traceability references.
- Evidence classification starts after the file and metadata are successfully persisted.

## RabbitMQ Processing Flow

```mermaid
sequenceDiagram
  autonumber
  participant Orchestrator as Task Orchestrator
  participant DB as PostgreSQL
  participant Tasks as securewatch.tasks
  participant Worker as Specialized Worker
  participant MinIO as MinIO
  participant Events as securewatch.events
  participant DLQ as tasks.dead_letter
  participant Notification as Notification Service

  Orchestrator->>DB: Create task with status pending
  Orchestrator->>Tasks: Publish task message by routing key
  Tasks-->>Orchestrator: Publisher confirmation
  Orchestrator->>DB: Update task status queued
  Orchestrator->>Events: Publish task.queued

  Tasks->>Worker: Deliver task message
  Worker->>DB: Mark task processing and claim worker_id
  Worker->>Events: Publish task.status_changed
  Worker->>MinIO: Download evidence or processed artifact
  Worker->>Worker: Process evidence
  Worker->>DB: Store findings, metrics, and task result
  Worker->>Events: Publish finding.created
  Worker->>DB: Mark task completed
  Worker->>Events: Publish task.status_changed
  Worker-->>Tasks: Ack message
  Events->>Notification: Consume finding.created
  Notification->>DB: Create alert if severity is high or critical

  alt Processing fails and retries remain
    Worker->>DB: Increment retry_count and mark retrying
    Worker-->>Tasks: Nack or republish with delay
    Worker->>Events: Publish task.status_changed
  else Processing fails and retries are exhausted
    Worker->>DB: Mark task dead_letter
    Worker-->>DLQ: Route message to dead-letter queue
    Worker->>Events: Publish task.failed
  end
```

### Processing Rules

- The Task Orchestrator is the only component that creates processing tasks.
- Workers consume only the queues that match their specialty.
- Task messages should contain identifiers, not full evidence content.
- Workers fetch files or artifacts from MinIO and persist results in PostgreSQL.
- Every state transition emits a domain event for dashboards, audit, and notifications.
- Failed tasks are retried up to `max_retries`; exhausted tasks move to the dead-letter queue.
- Workers must be stateless and horizontally replicable.

## Report Generation Flow

```mermaid
sequenceDiagram
  autonumber
  actor Analyst
  participant Web as Web App
  participant Gateway as API Gateway
  participant Auth as Auth Service
  participant Report as Report Service
  participant Case as Case Service
  participant DB as PostgreSQL
  participant MinIO as MinIO
  participant Events as securewatch.events

  Analyst->>Web: Request case report
  Web->>Gateway: POST /cases/{caseId}/report
  Gateway->>Auth: Validate JWT and role
  Auth-->>Gateway: Authorized user context
  Gateway->>Report: Request report generation
  Report->>Case: Validate case exists and user can access it
  Case-->>Report: Case metadata
  Report->>DB: Load evidence, tasks, findings, audit references, and metrics
  DB-->>Report: Case analysis dataset
  Report->>Report: Calculate summary and risk score
  Report->>Report: Generate PDF
  Report->>MinIO: Store generated report
  MinIO-->>Report: Report object key
  Report->>DB: Insert report metadata
  Report->>Events: Publish report.generated
  Report-->>Gateway: Report metadata
  Gateway-->>Web: Report status and metadata
  Web-->>Analyst: Show report summary and download action
```

### Report Rules

- Report Service owns report composition and generated report metadata.
- Reports are generated from persisted case state, not from transient worker memory.
- Generated PDFs are stored in MinIO.
- PostgreSQL stores report metadata, status, summary, risk score, file path, and creator.
- Download endpoints should use short-lived MinIO URLs or a proxied download through the API Gateway.
- Report generation should emit `report.generated` so the dashboard can update without a manual refresh.
