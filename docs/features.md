# SecureWatch — Features

---

## Case Management
- Create, update, filter, and archive investigation cases
- Priority levels: Low / Medium / High / Critical
- Status lifecycle: Open → In Progress → Closed → Archived
- Risk score (0–100) calculated automatically from findings severity
- Assign cases to team members

## Evidence
- **Multi-file upload** — select any number of files at once
- **Folder upload** — select an entire folder; files are filtered client-side by allowed type
- Upload queue with per-file status: pending → uploading (progress bar) → done / failed
- Unsupported files from folder shown in dismissible yellow notice
- File validation: type check, size limit, SHA-256 deduplication per case
- Supported types: images (JPEG, PNG, GIF, WebP, BMP, TIFF), audio (MP3, WAV, OGG, FLAC, M4A, WebM), documents (PDF, DOC/X, XLS/X, PPT/X), archives (ZIP, TAR, GZ, 7Z, RAR, BZ2), text (TXT, CSV, XML, JSON)
- Real-time status updates via Server-Sent Events (no polling)

## Automated Processing

Evidence is classified and routed to the right worker automatically.

| Worker | Input | Output |
|---|---|---|
| Text | TXT, CSV, XML, JSON, transcripts | Keywords, entities, risk matches |
| Document | PDF, DOC/X, XLS/X, PPT/X | Extracted text → feeds text worker |
| Image | JPEG, PNG, GIF, WebP, BMP, TIFF | Object detection, EXIF metadata |
| Audio | MP3, WAV, OGG, FLAC, M4A, WebM | Whisper transcription → feeds text worker |
| Archive | ZIP, TAR, GZ, 7Z, RAR, BZ2 | Content listing, suspicious file detection |

## Findings
- Severity: low / medium / high / critical
- Filterable by severity (clickable cards) and file type (chips)
- Paginated (10 per page), combinable filters
- Expandable detail view with structured data (JSON)

## Reports
- One-click PDF report generation per case
- Summary: risk score, findings breakdown by severity, evidence list
- Downloadable via presigned MinIO URL

## Real-Time Updates
- Server-Sent Events stream per case
- PostgreSQL `pg_notify` propagates worker results to browser
- Events: evidence status changes, new findings, task updates, alerts

## Internal Alerts
- Bell icon in sidebar with unread count badge
- Automatic notifications for high and critical findings
- Click to navigate to the relevant case
- Mark read individually or all at once

## Audit Trail
- Immutable event log for: case creation/update/status change, evidence upload, report generation/download
- Filterable by action, resource type, and actor email
- Paginated (50 per page)
- Accessible to admin and supervisor roles

## Dashboard
- Aggregated metrics: cases by status, evidence by state, findings by severity, task throughput
- Auto-refresh via SSE

## Observability
- Prometheus metrics on all Go services (`/metrics`)
- UUID path normalization in metrics labels
- Grafana dashboard: service health (UP/DOWN), request rate, 5xx error rate, endpoint breakdown, uptime
- RabbitMQ Management UI for queue inspection

## Security
- JWT authentication (HS256)
- Role-based access control: admin / supervisor / analyst
- Bcrypt password hashing
- CORS configurable per environment
