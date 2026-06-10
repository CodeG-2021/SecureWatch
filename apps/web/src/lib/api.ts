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
