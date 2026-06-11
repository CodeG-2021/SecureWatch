# SecureWatch — Processing Workers

Workers are stateless Python processes that consume tasks from RabbitMQ, fetch evidence from MinIO, process it, and write findings to PostgreSQL. All workers share the same base module (`services/workers/base/`).

---

## Worker Pipeline Overview

```mermaid
flowchart LR
  subgraph Upload["Upload Path"]
    Ev["Evidence Service"]
    TO["Task Orchestrator"]
  end

  subgraph Broker["RabbitMQ"]
    TQ["tasks.text"]
    DQ["tasks.document"]
    IQ["tasks.image"]
    AQ["tasks.audio"]
    ARQ["tasks.archive"]
    DLQ["tasks.dead_letter"]
  end

  subgraph Workers
    TW["Text Worker"]
    DW["Document Worker"]
    IW["Image Worker"]
    AW["Audio Worker"]
    ARW["Archive Worker"]
  end

  subgraph Outputs
    PG[("PostgreSQL\nfindings · tasks")]
    S3[("MinIO\nartifacts")]
  end

  Ev --> TO
  TO --> TQ & DQ & IQ & AQ & ARQ

  TQ --> TW
  DQ --> DW
  IQ --> IW
  AQ --> AW
  ARQ --> ARW

  TW --> PG
  DW --> PG & S3
  DW -->|"chain text task"| TQ
  IW --> PG
  AW --> PG & S3
  AW -->|"chain text task"| TQ
  ARW --> PG

  TW & DW & IW & AW & ARW -->|"exhausted retries"| DLQ
```

---

## Shared Base (`services/workers/base/`)

All workers import from this module:

| Module | Responsibility |
|---|---|
| `db.py` | PostgreSQL connection, `create_finding()`, `update_task_status()`, `pg_notify()` |
| `minio_client.py` | MinIO connection, `download_evidence()`, `upload_artifact()` |
| `rabbitmq.py` | RabbitMQ connection, message ack/nack, retry logic |
| `models.py` | Shared data classes (`TaskMessage`, `FindingPayload`) |

### `create_finding()`

Inserts a finding and, for `high` or `critical` severity, also inserts a notification and fires a `pg_notify` event:

```python
create_finding(
    case_id, evidence_id, task_id,
    finding_type="risk",
    title="Sensitive keyword detected",
    description="Found: 'classified'",
    severity="high",
    data={"keyword": "classified", "context": "..."},
)
```

---

## Text Worker

**Queue:** `tasks.text`  
**Processes:** plain text, CSV, XML, JSON files + transcripts from audio/document workers

### Processing Steps

```mermaid
flowchart TD
  A[Receive task] --> B[Download file from MinIO]
  B --> C[Normalize text]
  C --> D[Extract keywords]
  D --> E[Detect named entities]
  E --> F[Match risk patterns]
  F --> G[Calculate severity]
  G --> H[Register findings]
  H --> I[Update task completed]
```

### Findings Produced

| Finding type | Severity | Description |
|---|---|---|
| `keywords` | low–medium | Significant words extracted from content |
| `entities` | low–medium | Named entities: persons, organizations, locations |
| `risk` | medium–critical | Matches against risk keyword patterns |

---

## Document Worker

**Queue:** `tasks.document`  
**Processes:** PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX

### Processing Steps

```mermaid
flowchart TD
  A[Receive task] --> B[Download file from MinIO]
  B --> C{File type?}
  C -->|PDF| D[pdfplumber extraction]
  C -->|Office| E[python-docx / openpyxl]
  D & E --> F[Save extracted text to MinIO]
  F --> G[Register document_metadata finding]
  G --> H[Register document_text finding]
  H --> I[Publish chained text task]
  I --> J[Update task completed]
```

### Findings Produced

| Finding type | Description |
|---|---|
| `document_metadata` | Author, page count, creation date, software |
| `document_text` | First 500 chars of extracted text (preview) |

After extraction, publishes a **chained `tasks.text`** message so the text worker analyzes the extracted content.

---

## Image Worker

**Queue:** `tasks.image`  
**Processes:** JPEG, PNG, GIF, WebP, BMP, TIFF

### Processing Steps

```mermaid
flowchart TD
  A[Receive task] --> B[Download file from MinIO]
  B --> C[Extract EXIF metadata]
  C --> D[Run object detection]
  D --> E[Evaluate risk signals]
  E --> F[Register findings]
  F --> G[Update task completed]
```

### Findings Produced

| Finding type | Severity | Description |
|---|---|---|
| `image_metadata` | low | EXIF data: GPS, camera model, timestamp |
| `image_objects` | low–high | Detected objects and scene labels |

GPS coordinates in EXIF are flagged as `medium` severity.

---

## Audio Worker

**Queue:** `tasks.audio`  
**Processes:** MP3, WAV, OGG, FLAC, M4A, WebM

### Processing Steps

```mermaid
flowchart TD
  A[Receive task] --> B[Download file from MinIO]
  B --> C[Load Whisper model]
  C --> D[Transcribe audio]
  D --> E[Save transcript to MinIO]
  E --> F[Register transcription finding]
  F --> G{Duration check}
  G -->|Short / clear| H[Publish chained text task]
  G -->|Long / low confidence| I[Register warning finding]
  H & I --> J[Update task completed]
```

### Findings Produced

| Finding type | Severity | Description |
|---|---|---|
| `transcription` | low | Full audio transcript |
| `transcription_warning` | medium | Low confidence or very long audio |

After transcription, publishes a **chained `tasks.text`** message with the transcript content.

---

## Archive Worker

**Queue:** `tasks.archive`  
**Processes:** ZIP, TAR, GZ, 7Z, RAR, BZ2

### Processing Steps

```mermaid
flowchart TD
  A[Receive task] --> B[Download file from MinIO]
  B --> C[List archive contents]
  C --> D[Register archive_contents finding]
  D --> E{Suspicious files?}
  E -->|Yes| F[Register suspicious_file finding per file]
  E -->|No| G[Update task completed]
  F --> G
```

### Findings Produced

| Finding type | Severity | Description |
|---|---|---|
| `archive_contents` | low | File listing: names, sizes, paths |
| `suspicious_file` | medium–high | Executables, scripts, or hidden files inside the archive |

Suspicious extensions: `.exe`, `.dll`, `.bat`, `.sh`, `.ps1`, `.vbs`, `.js`, `.py` inside archives.

---

## Task Message Format

Published by Task Orchestrator to RabbitMQ:

```json
{
  "task_id":    "uuid",
  "case_id":    "uuid",
  "evidence_id": "uuid",
  "task_type":  "document",
  "priority":   "high",
  "retry_count": 0,
  "payload": {
    "storage_path": "case-uuid/evidence-uuid/report.pdf",
    "mime_type":    "application/pdf",
    "file_size":    84321
  }
}
```

---

## Retry & Dead Letter

Workers use `basic_nack(requeue=False)` on failure to route exhausted messages to `tasks.dead_letter` via the `securewatch.dlx` exchange.

| Attempt | Behavior |
|---|---|
| 1–3 | Re-queue with incremented `retry_count` |
| > 3 | Nack → dead letter queue, task marked `dead_letter` |

Dead-lettered tasks are visible in the [RabbitMQ Management UI](http://localhost:15672) under `tasks.dead_letter`.

---

## Environment Variables (Workers)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `RABBITMQ_URL` | `amqp://user:pass@rabbitmq:5672/` |
| `MINIO_ENDPOINT` | `minio:9000` |
| `MINIO_ACCESS_KEY` | MinIO root user |
| `MINIO_SECRET_KEY` | MinIO root password |
| `MINIO_BUCKET_EVIDENCE` | Default: `securewatch-evidence` |
| `WHISPER_MODEL` | Whisper model size: `tiny` / `base` / `small` (audio worker) |
| `DETECTION_CONFIDENCE` | Object detection threshold (image worker, default `0.4`) |
