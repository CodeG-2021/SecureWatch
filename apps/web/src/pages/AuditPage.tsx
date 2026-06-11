import { useCallback, useEffect, useState } from "react"
import { AppLayout } from "../components/AppLayout"
import { type AuditEvent, listAuditEvents } from "../lib/api"
import {
  FunnelIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline"

// ─── Action metadata ──────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  "case.created":       { label: "Case Created",      cls: "bg-teal-50 text-teal-700 border border-teal-200"    },
  "case.updated":       { label: "Case Updated",      cls: "bg-blue-50 text-blue-700 border border-blue-200"    },
  "case.status_changed":{ label: "Status Changed",    cls: "bg-purple-50 text-purple-700 border border-purple-200" },
  "evidence.uploaded":  { label: "Evidence Uploaded", cls: "bg-indigo-50 text-indigo-700 border border-indigo-200" },
  "report.generated":   { label: "Report Generated",  cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  "report.downloaded":  { label: "Report Accessed",   cls: "bg-orange-50 text-orange-700 border border-orange-200" },
}

const RESOURCE_ICONS: Record<string, string> = {
  case:     "📁",
  evidence: "🔎",
  report:   "📄",
}

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_LABELS[action] ?? { label: action, cls: "bg-slate-100 text-slate-600" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  )
}

function MetadataCell({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(([k]) => k !== "ip_address")
  if (entries.length === 0) return <span className="text-slate-400">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {entries.slice(0, 3).map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">
          <span className="font-medium">{k}:</span>
          <span className="truncate max-w-[120px]">{String(v)}</span>
        </span>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export function AuditPage() {
  const [events,   setEvents]   = useState<AuditEvent[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [page,     setPage]     = useState(0)

  const [filterAction,   setFilterAction]   = useState("")
  const [filterResource, setFilterResource] = useState("")
  const [filterEmail,    setFilterEmail]    = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAuditEvents({
        action:        filterAction   || undefined,
        resource_type: filterResource || undefined,
        actor_email:   filterEmail    || undefined,
        limit:  PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      setEvents(data.events)
      setTotal(data.total)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [filterAction, filterResource, filterEmail, page])

  useEffect(() => { load() }, [load])

  function handleFilter(e: React.FormEvent) {
    e.preventDefault()
    setPage(0)
    load()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <AppLayout>
      <div className="page-enter p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
            <p className="text-sm text-slate-500 mt-0.5">System-wide activity trail — {total.toLocaleString()} events</p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200
                       text-slate-600 text-sm font-medium transition-colors"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <form onSubmit={handleFilter} className="flex flex-wrap gap-3 mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <FunnelIcon className="w-4 h-4" />
            <span className="text-sm font-medium">Filter</span>
          </div>

          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>

          <select
            value={filterResource}
            onChange={e => setFilterResource(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All resources</option>
            <option value="case">Case</option>
            <option value="evidence">Evidence</option>
            <option value="report">Report</option>
          </select>

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Filter by email..."
              value={filterEmail}
              onChange={e => setFilterEmail(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
          >
            Apply
          </button>
          {(filterAction || filterResource || filterEmail) && (
            <button
              type="button"
              onClick={() => { setFilterAction(""); setFilterResource(""); setFilterEmail(""); setPage(0) }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-400 text-sm">No audit events found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Timestamp</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Actor</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Action</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Resource</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Details</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map(ev => (
                    <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-800 font-medium text-xs">
                          {new Date(ev.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-slate-400 text-xs">
                          {new Date(ev.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-slate-700 text-xs">{ev.actor_email}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ActionBadge action={ev.action} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base leading-none">{RESOURCE_ICONS[ev.resource_type] ?? "📦"}</span>
                          <div>
                            <span className="text-xs font-medium text-slate-700 capitalize">{ev.resource_type}</span>
                            {ev.resource_id && (
                              <div className="text-xs text-slate-400 font-mono">
                                {ev.resource_id.slice(0, 8)}…
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <MetadataCell metadata={ev.metadata} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-slate-400 font-mono">{ev.ip_address ?? "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-slate-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600
                           hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600
                           hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
