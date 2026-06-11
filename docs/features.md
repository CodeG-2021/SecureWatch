# SecureWatch — Implemented Features

Status of all user stories from the requirements document.

---

## Phase 1 — Project Foundation

| Story | Title | Status |
|---|---|---|
| HU-00 | Project initialization | ✅ Done |
| HU-01 | Base architecture definition | ✅ Done |
| HU-02 | Local infrastructure with Docker Compose | ✅ Done |
| HU-03 | API Gateway with health checks, CORS, auth middleware | ✅ Done |

---

## Phase 2 — Security and Users

| Story | Title | Status |
|---|---|---|
| HU-04 | User registration | ✅ Done |
| HU-05 | User sign-in with JWT | ✅ Done |
| HU-06 | Role-based access (admin, supervisor, analyst) | ✅ Done |

---

## Phase 3 — Cases and Evidence

| Story | Title | Status |
|---|---|---|
| HU-07 | Create case | ✅ Done |
| HU-08 | List and filter cases | ✅ Done |
| HU-09 | View case details | ✅ Done |
| HU-10 | Update case (title, description, priority, status, assignee) | ✅ Done |
| HU-11 | Upload evidence (multi-file + folder with MIME filtering) | ✅ Done |
| HU-12 | Validate evidence (type, size, duplicate hash) | ✅ Done |
| HU-13 | Classify evidence and dispatch to workers | ✅ Done |

---

## Phase 4 — Distributed Orchestration

| Story | Title | Status |
|---|---|---|
| HU-14 | Automatic task creation after upload | ✅ Done |
| HU-15 | Task queuing in RabbitMQ | ✅ Done |
| HU-27 | Retries and dead-letter queue | 🔄 Planned |
| HU-28 | Cancel task or case | 🔄 Planned |

---

## Phase 5 — Workers

| Story | Title | Status |
|---|---|---|
| HU-16 | Text processing (keywords, entities, risk) | ✅ Done |
| HU-17 | Document processing (PDF/Office extraction) | ✅ Done |
| HU-18 | Image processing (object detection, metadata) | ✅ Done |
| HU-19 | Audio processing (Whisper transcription) | ✅ Done |
| HU-20 | Archive processing (contents inspection) | ✅ Done |
| HU-21 | Risk score calculation per case | ✅ Done |

---

## Phase 6 — Results

| Story | Title | Status |
|---|---|---|
| HU-22 | Report generation (PDF via case data) | ✅ Done |
| HU-23 | Report download via presigned MinIO URL | ✅ Done |
| HU-26 | Internal alerts (notifications for high/critical findings) | ✅ Done |

---

## Phase 7 — Monitoring and Presentation

| Story | Title | Status |
|---|---|---|
| HU-24 | General dashboard with aggregated metrics | ✅ Done |
| HU-25 | Real-time updates via SSE | ✅ Done |
| HU-29 | Audit trail (immutable event log with filters) | ✅ Done |
| HU-30 | Prometheus metrics + Grafana dashboards | ✅ Done |
| HU-31 | Load testing | 🔄 Planned |
| HU-32 | Project documentation | ✅ Done |

---

## Feature Details

### Multi-file & Folder Upload (HU-11)
- `multiple` attribute on file input — select any number of files at once
- `webkitdirectory` input — select an entire folder; files are filtered client-side by allowed extension
- Upload queue UI with per-file status: pending → uploading (with progress bar) → done / failed
- Unsupported files from folder uploads shown in dismissible yellow banner
- Sequential upload processing to avoid overwhelming the server

### Real-Time SSE (HU-25)
- API Gateway exposes `GET /api/v1/cases/{id}/stream?token=<jwt>`
- PostgreSQL `pg_notify` on channel `securewatch_events` propagates worker results to gateway
- Events: `evidence_updated`, `finding_created`, `task_updated`, `notification`
- Browser hook `useCaseStream` subscribes and updates UI without manual refresh

### Internal Alerts (HU-26)
- Workers insert into `notifications` table for `high` and `critical` findings
- Bell icon in sidebar shows unread count badge
- Dropdown shows last 10 notifications with severity color dot
- Click navigates to the relevant case
- Real-time: SSE `notification` event triggers immediate badge update

### Audit Trail (HU-29)
- `audit_events` table with TEXT actor fields (no FK) for cross-service writes
- Recorded actions: `case.created`, `case.updated`, `case.status_changed`, `evidence.uploaded`, `report.generated`, `report.downloaded`
- Audit page accessible to admin and supervisor roles
- Filterable by action, resource type, and actor email
- Paginated (50 per page)

### Metrics & Observability (HU-30)
- Prometheus metrics implemented in stdlib (no external library)
- UUID path normalization: `/cases/abc-123/evidences` → `/cases/{id}/evidences`
- Metrics: `securewatch_up`, `securewatch_uptime_seconds`, `http_requests_total{service,method,path,status}`
- Grafana dashboard: service health (UP/DOWN), request rate, 5xx error rate, endpoint breakdown, uptime

### Findings Tab Filters
- Clickable severity cards: All / Critical / High / Medium / Low
- File type chips: All / Image / Audio / Document / Text / Archive
- Combined filters (e.g., Critical + Audio)
- Pagination: 10 findings per page
- "Clear filters" shortcut when any filter is active
