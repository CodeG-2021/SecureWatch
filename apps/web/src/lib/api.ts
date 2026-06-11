import { getToken } from "./session"

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RegisterPayload = {
  name:     string
  email:    string
  password: string
  role:     string
}

export type LoginPayload = {
  email:    string
  password: string
}

export type Case = {
  id:               string
  title:            string
  description:      string
  priority:         "low" | "medium" | "high" | "critical"
  status:           "open" | "in_progress" | "closed" | "archived"
  created_by:       string
  created_by_name?: string
  assigned_to?:     string
  assigned_to_name?: string
  risk_score:       number
  findings_count:   number
  created_at:       string
  updated_at:       string
  closed_at?:       string
}

export type CreateCasePayload = {
  title:        string
  description?: string
  priority:     string
  assigned_to?: string
}

export type UpdateCasePayload = {
  title?:       string
  description?: string
  priority?:    string
  status?:      string
  assigned_to?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message ?? `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export async function registerUser(payload: RegisterPayload) {
  const res = await fetch(`${BASE}/api/v1/auth/register`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  })
  return handleResponse<{ user: { id: string; name: string; email: string; role: string } }>(res)
}

export async function loginUser(payload: LoginPayload) {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  })
  return handleResponse<{ token: string; user: { id: string; name: string; email: string; role: string } }>(res)
}

// ─── Cases ─────────────────────────────────────────────────────────────────────

export async function listCases(params?: { status?: string; priority?: string; search?: string }) {
  const qs = new URLSearchParams()
  if (params?.status)   qs.set("status",   params.status)
  if (params?.priority) qs.set("priority", params.priority)
  if (params?.search)   qs.set("search",   params.search)
  const query = qs.toString() ? `?${qs}` : ""
  const res = await fetch(`${BASE}/api/v1/cases${query}`, { headers: authHeaders() })
  return handleResponse<{ cases: Case[]; total: number }>(res)
}

export async function getCase(id: string) {
  const res = await fetch(`${BASE}/api/v1/cases/${id}`, { headers: authHeaders() })
  return handleResponse<{ case: Case }>(res)
}

export async function createCase(payload: CreateCasePayload) {
  const res = await fetch(`${BASE}/api/v1/cases`, {
    method:  "POST",
    headers: authHeaders(),
    body:    JSON.stringify(payload),
  })
  return handleResponse<{ case: Case }>(res)
}

export async function updateCase(id: string, payload: UpdateCasePayload) {
  const res = await fetch(`${BASE}/api/v1/cases/${id}`, {
    method:  "PATCH",
    headers: authHeaders(),
    body:    JSON.stringify(payload),
  })
  return handleResponse<{ case: Case }>(res)
}

// ─── Evidence ──────────────────────────────────────────────────────────────────

export type Evidence = {
  id:                string
  case_id:           string
  original_filename: string
  file_type:         "text" | "image" | "audio" | "document" | "archive" | "unknown"
  mime_type:         string
  storage_path:      string
  size_bytes:        number
  hash_sha256:       string
  status:            "uploaded" | "classified" | "queued" | "processing" | "completed" | "failed"
  uploaded_by:       string
  uploaded_by_name?: string
  created_at:        string
  updated_at:        string
}

/** Upload a file as evidence for a case. Calls `onProgress` with 0–100. */
export function uploadEvidence(
  caseId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<Evidence> {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const form = new FormData()
    form.append("file", file)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", `${BASE}/api/v1/cases/${caseId}/evidences`)
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data as Evidence)
        } else {
          reject(new Error(data?.error ?? `Upload failed (${xhr.status})`))
        }
      } catch {
        reject(new Error("Invalid response from server"))
      }
    }
    xhr.onerror = () => reject(new Error("Network error during upload"))
    xhr.send(form)
  })
}

export async function listEvidences(caseId: string) {
  const res = await fetch(`${BASE}/api/v1/cases/${caseId}/evidences`, { headers: authHeaders() })
  return handleResponse<{ evidences: Evidence[]; total: number }>(res)
}

// ─── Findings ──────────────────────────────────────────────────────────────────

export type Finding = {
  id:                string
  case_id:           string
  evidence_id:       string
  task_id?:          string
  finding_type:      string
  title:             string
  description?:      string
  severity:          "low" | "medium" | "high" | "critical"
  data:              Record<string, unknown>
  created_at:        string
  evidence_filename?: string
}

export async function listFindings(caseId: string, evidenceId?: string) {
  const qs = evidenceId ? `?evidence_id=${evidenceId}` : ""
  const res = await fetch(`${BASE}/api/v1/cases/${caseId}/findings${qs}`, { headers: authHeaders() })
  return handleResponse<{ findings: Finding[]; total: number }>(res)
}

// ─── Reports ───────────────────────────────────────────────────────────────────

export type ReportSummary = {
  case_title:      string
  priority:        string
  status:          string
  risk_score:      number
  evidences_count: number
  findings_count:  number
  critical:        number
  high:            number
  medium:          number
  low:             number
}

export type Report = {
  id:              string
  case_id:         string
  generated_by:    string
  storage_path:    string
  file_size_bytes: number
  summary:         ReportSummary
  created_at:      string
  download_url?:   string
}

export async function generateReport(caseId: string) {
  const res = await fetch(`${BASE}/api/v1/cases/${caseId}/report`, {
    method:  "POST",
    headers: authHeaders(),
  })
  return handleResponse<{ report: Report }>(res)
}

export async function getReport(caseId: string) {
  const res = await fetch(`${BASE}/api/v1/cases/${caseId}/report`, { headers: authHeaders() })
  if (res.status === 404) return null
  return handleResponse<{ report: Report }>(res)
}

// ─── Audit Events (HU-29) ─────────────────────────────────────────────────────

export type AuditEvent = {
  id:            string
  actor_id:      string
  actor_email:   string
  action:        string
  resource_type: string
  resource_id?:  string
  metadata:      Record<string, unknown>
  ip_address?:   string
  created_at:    string
}

export async function listAuditEvents(params?: {
  action?: string
  resource_type?: string
  actor_email?: string
  limit?: number
  offset?: number
}) {
  const qs = new URLSearchParams()
  if (params?.action)        qs.set("action",        params.action)
  if (params?.resource_type) qs.set("resource_type", params.resource_type)
  if (params?.actor_email)   qs.set("actor_email",   params.actor_email)
  if (params?.limit)         qs.set("limit",         String(params.limit))
  if (params?.offset)        qs.set("offset",        String(params.offset))
  const query = qs.toString() ? `?${qs}` : ""
  const res = await fetch(`${BASE}/api/v1/audit${query}`, { headers: authHeaders() })
  return handleResponse<{ events: AuditEvent[]; total: number }>(res)
}

// ─── Notifications (HU-26) ────────────────────────────────────────────────────

export type Notification = {
  id:          string
  case_id:     string
  finding_id?: string
  title:       string
  message:     string
  severity:    "low" | "medium" | "high" | "critical"
  read_at?:    string
  created_at:  string
}

export async function listNotifications(unreadOnly = false) {
  const qs = unreadOnly ? "?unread=true" : ""
  const res = await fetch(`${BASE}/api/v1/notifications${qs}`, { headers: authHeaders() })
  return handleResponse<{ notifications: Notification[]; total: number }>(res)
}

export async function markNotificationRead(id: string) {
  const res = await fetch(`${BASE}/api/v1/notifications/${id}/read`, {
    method:  "PATCH",
    headers: authHeaders(),
  })
  return handleResponse<{ ok: boolean }>(res)
}

export async function markAllNotificationsRead() {
  return markNotificationRead("all")
}

// ─── Dashboard metrics (HU-24) ─────────────────────────────────────────────────

export type DashboardMetrics = {
  cases: {
    total: number; open: number; in_progress: number
    closed: number; archived: number; critical: number
  }
  evidences: {
    total: number; completed: number; processing: number; failed: number; queued: number
  }
  findings: {
    total: number; critical: number; high: number; medium: number; low: number
  }
  tasks: {
    total: number; completed: number; failed: number; processing: number; pending: number
  }
}

export async function getDashboardMetrics() {
  const res = await fetch(`${BASE}/api/v1/dashboard/metrics`, { headers: authHeaders() })
  return handleResponse<DashboardMetrics>(res)
}
