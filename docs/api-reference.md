# SecureWatch — API Reference

All requests go through the API Gateway at `http://localhost:8080`.

Protected endpoints require:
```
Authorization: Bearer <jwt>
```

---

## Authentication

### `POST /api/v1/auth/register`
Register a new user.

**Body**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "secret123",
  "role": "analyst"
}
```

**Response `201`**
```json
{
  "user": { "id": "...", "name": "Jane Doe", "email": "jane@example.com", "role": "analyst" }
}
```

---

### `POST /api/v1/auth/login`
Sign in and receive a JWT.

**Body**
```json
{ "email": "jane@example.com", "password": "secret123" }
```

**Response `200`**
```json
{
  "token": "<jwt>",
  "user": { "id": "...", "name": "Jane Doe", "email": "...", "role": "analyst" }
}
```

---

### `GET /api/v1/me` 🔒
Returns the authenticated user's decoded claims.

---

## Users

### `GET /api/v1/users` 🔒 `admin`
List all users.

### `PATCH /api/v1/users/{id}` 🔒 `admin`
Update a user's role or name.

### `DELETE /api/v1/users/{id}` 🔒 `admin`
Delete a user.

---

## Cases

### `GET /api/v1/cases` 🔒
List cases with optional filters.

**Query params**
| Param | Values |
|---|---|
| `status` | `open` / `in_progress` / `closed` / `archived` |
| `priority` | `low` / `medium` / `high` / `critical` |
| `search` | Title substring search |

**Response `200`**
```json
{ "cases": [...], "total": 12 }
```

---

### `POST /api/v1/cases` 🔒
Create a new case.

**Body**
```json
{
  "title": "Investigation Alpha",
  "description": "...",
  "priority": "high",
  "assigned_to": "<user-uuid>"
}
```

---

### `GET /api/v1/cases/{id}` 🔒
Get case details.

---

### `PATCH /api/v1/cases/{id}` 🔒
Update case fields.

**Body** (all fields optional)
```json
{
  "title": "...",
  "description": "...",
  "priority": "critical",
  "status": "in_progress",
  "assigned_to": "<user-uuid>"
}
```

---

## Evidence

### `POST /api/v1/cases/{caseId}/evidences` 🔒
Upload a single evidence file.

**Content-Type:** `multipart/form-data`  
**Field:** `file`

Supported MIME types: images (jpeg, png, gif, webp, bmp, tiff), audio (mp3, wav, ogg, flac, m4a, webm), documents (pdf, doc, docx, xls, xlsx, ppt, pptx), archives (zip, tar, gz, 7z, rar, bz2), text (txt, csv, xml, json).

**Response `201`** — Evidence object with initial status `uploaded`.

---

### `GET /api/v1/cases/{caseId}/evidences` 🔒
List all evidence for a case.

**Response `200`**
```json
{ "evidences": [...], "total": 5 }
```

---

### `GET /api/v1/cases/{caseId}/stream?token=<jwt>`
Server-Sent Events stream for a case. Use `?token=` instead of the `Authorization` header (SSE browser limitation).

**Events emitted:**
| Event | Description |
|---|---|
| `evidence_updated` | Evidence status changed |
| `finding_created` | New finding registered |
| `task_updated` | Task status changed |
| `notification` | High or critical finding alert |

---

## Findings

### `GET /api/v1/cases/{caseId}/findings` 🔒
List findings for a case.

**Query params**
| Param | Description |
|---|---|
| `evidence_id` | Filter by evidence |

**Response `200`**
```json
{ "findings": [...], "total": 24 }
```

---

## Reports

### `POST /api/v1/cases/{caseId}/report` 🔒
Generate (or regenerate) the case report. Returns the report metadata including a short-lived download URL.

**Response `200`**
```json
{
  "report": {
    "id": "...",
    "case_id": "...",
    "storage_path": "...",
    "file_size_bytes": 84321,
    "summary": {
      "case_title": "Investigation Alpha",
      "priority": "high",
      "status": "in_progress",
      "risk_score": 72,
      "evidences_count": 8,
      "findings_count": 15,
      "critical": 2,
      "high": 5,
      "medium": 6,
      "low": 2
    },
    "download_url": "http://localhost:9000/...",
    "created_at": "..."
  }
}
```

---

### `GET /api/v1/cases/{caseId}/report` 🔒
Get the latest report for a case. Returns `404` if no report exists yet.

---

## Notifications

### `GET /api/v1/notifications` 🔒
List all notifications for the authenticated user.

**Query params**
| Param | Values |
|---|---|
| `unread` | `true` — return only unread |

---

### `PATCH /api/v1/notifications/{id}/read` 🔒
Mark a notification as read. Use `id = all` to mark all as read.

---

## Audit Log

### `GET /api/v1/audit` 🔒 `admin` / `supervisor`
List audit events with pagination.

**Query params**
| Param | Description |
|---|---|
| `action` | `case.created` / `case.updated` / `case.status_changed` / `evidence.uploaded` / `report.generated` / `report.downloaded` |
| `resource_type` | `case` / `evidence` / `report` |
| `actor_email` | Filter by email substring |
| `limit` | Default 50 |
| `offset` | Default 0 |

**Response `200`**
```json
{ "events": [...], "total": 312 }
```

---

## Dashboard

### `GET /api/v1/dashboard/metrics` 🔒
Aggregated platform metrics.

**Response `200`**
```json
{
  "cases":     { "total": 12, "open": 4, "in_progress": 3, "closed": 4, "archived": 1, "critical": 2 },
  "evidences": { "total": 87, "completed": 71, "processing": 3, "failed": 2, "queued": 11 },
  "findings":  { "total": 234, "critical": 8, "high": 42, "medium": 98, "low": 86 },
  "tasks":     { "total": 95, "completed": 82, "failed": 4, "processing": 3, "pending": 6 }
}
```

---

## Health & Observability

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/healthz` | None | Liveness probe |
| `GET` | `/readyz` | None | Readiness probe |
| `GET` | `/metrics` | None | Prometheus text format metrics |

---

## Error Format

All errors return a consistent JSON body:

```json
{
  "error": {
    "code": "EVIDENCE_DUPLICATE",
    "message": "A file with this hash already exists in this case"
  }
}
```

Common HTTP status codes:

| Status | Meaning |
|---|---|
| `400` | Invalid request body or parameters |
| `401` | Missing or invalid JWT |
| `403` | Insufficient role |
| `404` | Resource not found |
| `409` | Conflict (e.g., duplicate evidence hash) |
| `413` | File too large |
| `415` | Unsupported MIME type |
| `500` | Internal server error |
