import { useEffect, useRef } from "react"
import { getToken } from "./session"

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"

export type StreamEvent =
  | { type: "task_updated";    case_id: string; evidence_id: string; task_id: string; status: string }
  | { type: "evidence_updated"; case_id: string; evidence_id: string; status: string }
  | { type: "finding_created"; case_id: string; evidence_id: string; finding_id: string; severity: string; title: string }
  | { type: "risk_updated";    case_id: string; risk_score: number; findings_count: number }

export type StreamHandlers = {
  onTaskUpdated?:     (e: Extract<StreamEvent, { type: "task_updated" }>)     => void
  onEvidenceUpdated?: (e: Extract<StreamEvent, { type: "evidence_updated" }>) => void
  onFindingCreated?:  (e: Extract<StreamEvent, { type: "finding_created" }>)  => void
  onRiskUpdated?:     (e: Extract<StreamEvent, { type: "risk_updated" }>)     => void
}

export function useCaseStream(caseId: string | undefined, handlers: StreamHandlers) {
  // Keep handlers in a ref so we don't reconnect when callbacks change.
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!caseId) return
    const token = getToken()
    if (!token) return

    const url = `${BASE}/api/v1/cases/${caseId}/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)

    es.addEventListener("task_updated", (e: MessageEvent) => {
      try { handlersRef.current.onTaskUpdated?.(JSON.parse(e.data)) } catch {}
    })
    es.addEventListener("evidence_updated", (e: MessageEvent) => {
      try { handlersRef.current.onEvidenceUpdated?.(JSON.parse(e.data)) } catch {}
    })
    es.addEventListener("finding_created", (e: MessageEvent) => {
      try { handlersRef.current.onFindingCreated?.(JSON.parse(e.data)) } catch {}
    })
    es.addEventListener("risk_updated", (e: MessageEvent) => {
      try { handlersRef.current.onRiskUpdated?.(JSON.parse(e.data)) } catch {}
    })

    return () => { es.close() }
  }, [caseId])
}
