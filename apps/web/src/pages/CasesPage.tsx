import { useEffect, useRef, useState } from "react"
import {
  FolderOpenIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  FunnelIcon,
  EllipsisVerticalIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
  ChevronDownIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline"
import { AppLayout } from "../components/AppLayout"
import { type Case, listCases } from "../lib/api"

// ─── Visual helpers ───────────────────────────────────────────────────────────

type Priority = Case["priority"]
type Status   = Case["status"]

function priorityBadge(p: Priority) {
  const map: Record<Priority, { cls: string; label: string }> = {
    critical: { cls: "bg-red-50    text-red-700    border border-red-200",    label: "Critical" },
    high:     { cls: "bg-orange-50 text-orange-700 border border-orange-200", label: "High"     },
    medium:   { cls: "bg-amber-50  text-amber-700  border border-amber-200",  label: "Medium"   },
    low:      { cls: "bg-blue-50   text-blue-700   border border-blue-200",   label: "Low"      },
  }
  const { cls, label } = map[p] ?? map.medium
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold leading-5 whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}

function statusBadge(s: Status) {
  const map: Record<Status, { cls: string; dot: string; label: string }> = {
    open:        { cls: "bg-slate-100  text-slate-600",  dot: "bg-slate-400",   label: "Open"        },
    in_progress: { cls: "bg-teal-50    text-teal-700",   dot: "bg-teal-500",    label: "In Progress" },
    closed:      { cls: "bg-green-50   text-green-700",  dot: "bg-green-500",   label: "Closed"      },
    archived:    { cls: "bg-gray-100   text-gray-500",   dot: "bg-gray-400",    label: "Archived"    },
  }
  const { cls, dot, label } = map[s] ?? map.open
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold leading-5 ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot} ${s === "in_progress" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  )
}

function priorityBorderClass(p: Priority) {
  const map: Record<Priority, string> = {
    critical: "priority-critical",
    high:     "priority-high",
    medium:   "priority-medium",
    low:      "priority-low",
  }
  return map[p] ?? "priority-medium"
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function initials(name?: string) {
  if (!name) return "?"
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CASES: Case[] = [
  {
    id: "c001", title: "Suspicious Login Activity – SRV-01",
    description: "Multiple failed auth attempts followed by successful login from unusual geolocation.",
    priority: "critical", status: "in_progress",
    created_by: "u1", created_by_name: "Ana García",
    assigned_to: "u2", assigned_to_name: "Luis Mora",
    created_at: "2026-05-28T10:00:00Z", updated_at: "2026-06-01T15:00:00Z",
  },
  {
    id: "c002", title: "Malware Detected – Workstation WK-42",
    description: "Endpoint protection flagged Trojan.GenericKD in document macro.",
    priority: "high", status: "open",
    created_by: "u1", created_by_name: "Ana García",
    created_at: "2026-06-01T09:00:00Z", updated_at: "2026-06-01T09:00:00Z",
  },
  {
    id: "c003", title: "Data Exfiltration Attempt via USB",
    description: "DLP alert triggered on large file transfer to removable media.",
    priority: "high", status: "open",
    created_by: "u3", created_by_name: "Sara Pérez",
    assigned_to: "u2", assigned_to_name: "Luis Mora",
    created_at: "2026-06-03T14:30:00Z", updated_at: "2026-06-03T14:30:00Z",
  },
  {
    id: "c004", title: "Phishing Campaign – Finance Dept",
    description: "5 employees received targeted spear-phishing emails, 2 clicked links.",
    priority: "medium", status: "closed",
    created_by: "u2", created_by_name: "Luis Mora",
    created_at: "2026-05-20T11:00:00Z", updated_at: "2026-05-25T16:00:00Z",
    closed_at: "2026-05-25T16:00:00Z",
  },
  {
    id: "c005", title: "Unauthorized Cloud Storage Access",
    description: "Service account accessed S3 bucket outside of business hours.",
    priority: "low", status: "archived",
    created_by: "u3", created_by_name: "Sara Pérez",
    created_at: "2026-04-10T08:00:00Z", updated_at: "2026-04-30T12:00:00Z",
    closed_at: "2026-04-30T12:00:00Z",
  },
]

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon:  React.ReactNode
  label: string
  value: number
  color: string
  delay: number
}

function StatCard({ icon, label, value, color, delay }: StatCardProps) {
  return (
    <div
      className="card-enter bg-white rounded-2xl border border-outline-variant/60 p-5 flex items-center gap-4
                 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-on-surface leading-none">{value}</p>
        <p className="text-xs text-on-surface-variant mt-1 font-medium">{label}</p>
      </div>
    </div>
  )
}

// ─── Row action menu ─────────────────────────────────────────────────────────
// Uses position:fixed so it escapes overflow:hidden on the table container.

function RowMenu({ caseItem }: { caseItem: Case }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, right: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen(v => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-outline
                   hover:text-on-surface hover:bg-surface-container
                   opacity-0 group-hover:opacity-100 focus:opacity-100
                   transition-all duration-150"
      >
        <EllipsisVerticalIcon className="w-5 h-5" />
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{ top: pos.top, right: pos.right }}
          className="fixed w-44 bg-white border border-outline-variant rounded-xl
                     shadow-xl z-[100] py-1"
        >
          <button
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-on-surface
                       hover:bg-surface-container transition-colors"
            onClick={() => { setOpen(false); window.location.href = `/cases/${caseItem.id}` }}
          >
            <FolderOpenIcon className="w-4 h-4 text-on-surface-variant" />
            Open case
          </button>
          <div className="my-1 border-t border-outline-variant/50" />
          <button
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-error
                       hover:bg-error/5 transition-colors"
            onClick={() => setOpen(false)}
          >
            <ArchiveBoxIcon className="w-4 h-4" />
            Archive
          </button>
        </div>
      )}
    </>
  )
}

// ─── Filter select ────────────────────────────────────────────────────────────

interface FilterSelectProps {
  value:    string
  onChange: (v: string) => void
  options:  { value: string; label: string }[]
  placeholder: string
}

function FilterSelect({ value, onChange, options, placeholder }: FilterSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none h-9 pl-3 pr-8 bg-white border border-outline-variant rounded-lg
                   text-sm text-on-surface focus:outline-none focus:border-secondary focus:ring-1
                   focus:ring-secondary transition-colors cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDownIcon className="w-4 h-4 text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CasesPage() {
  const [cases,    setCases]    = useState<Case[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [search,   setSearch]   = useState("")
  const [status,   setStatus]   = useState("")
  const [priority, setPriority] = useState("")

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await listCases({ status, priority, search })
      setCases(data.cases)
    } catch {
      setCases(MOCK_CASES)   // graceful fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status, priority]) // eslint-disable-line react-hooks/exhaustive-deps

  // client-side search on top of server filters
  const filtered = cases.filter(c =>
    !search ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.description ?? "").toLowerCase().includes(search.toLowerCase())
  )

  // stat counts
  const total      = cases.length
  const openCount  = cases.filter(c => c.status === "open").length
  const inProgress = cases.filter(c => c.status === "in_progress").length
  const critical   = cases.filter(c => c.priority === "critical").length

  return (
    <AppLayout>
      <div className="page-enter p-8 max-w-7xl mx-auto space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Cases</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Manage and track your digital forensic investigations
            </p>
          </div>
          <a
            href="/cases/new"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl
                       bg-primary text-white text-sm font-semibold
                       hover:bg-surface-tint transition-colors duration-150 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            New Case
          </a>
        </div>

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FolderOpenIcon className="w-5 h-5 text-primary" />}
            label="Total Cases" value={total}
            color="bg-primary/10" delay={0}
          />
          <StatCard
            icon={<ClockIcon className="w-5 h-5 text-blue-600" />}
            label="Open" value={openCount}
            color="bg-blue-50" delay={60}
          />
          <StatCard
            icon={<ArrowPathIcon className="w-5 h-5 text-teal-600" />}
            label="In Progress" value={inProgress}
            color="bg-teal-50" delay={120}
          />
          <StatCard
            icon={<ExclamationTriangleIcon className="w-5 h-5 text-red-600" />}
            label="Critical" value={critical}
            color="bg-red-50" delay={180}
          />
        </div>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-0 max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              type="text"
              placeholder="Search cases..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 bg-white border border-outline-variant rounded-lg
                         text-sm text-on-surface placeholder:text-outline
                         focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary
                         transition-colors"
            />
          </div>

          {/* Dropdowns */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-4 h-4 text-outline shrink-0" />
            <FilterSelect
              value={status} onChange={setStatus}
              placeholder="All statuses"
              options={[
                { value: "open",        label: "Open"        },
                { value: "in_progress", label: "In Progress" },
                { value: "closed",      label: "Closed"      },
                { value: "archived",    label: "Archived"    },
              ]}
            />
            <FilterSelect
              value={priority} onChange={setPriority}
              placeholder="All priorities"
              options={[
                { value: "critical", label: "Critical" },
                { value: "high",     label: "High"     },
                { value: "medium",   label: "Medium"   },
                { value: "low",      label: "Low"      },
              ]}
            />
          </div>

          {/* Count */}
          <span className="text-sm text-on-surface-variant ml-auto whitespace-nowrap">
            {filtered.length} {filtered.length === 1 ? "case" : "cases"}
          </span>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-outline-variant/60 overflow-hidden shadow-sm">

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_100px_130px_110px_36px] gap-4 px-5 py-3
                          border-b border-outline-variant/60 bg-surface-container-low/60">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Case</span>
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Priority</span>
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Status</span>
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Date</span>
            <span />
          </div>

          {/* Rows */}
          {loading ? (
            <div className="divide-y divide-outline-variant/40">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_130px_110px_36px] gap-4 px-5 py-4">
                  <div className="space-y-2">
                    <div className="skeleton h-4 w-2/3" />
                    <div className="skeleton h-3 w-1/2" />
                  </div>
                  <div className="skeleton h-5 w-16 rounded-md" />
                  <div className="skeleton h-5 w-20 rounded-full" />
                  <div className="skeleton h-4 w-20" />
                  <div />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center">
                <FolderOpenIcon className="w-8 h-8 text-outline" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-on-surface">No cases found</p>
                <p className="text-sm text-on-surface-variant mt-1">
                  {search || status || priority
                    ? "Try adjusting your filters"
                    : "Create your first case to get started"}
                </p>
              </div>
              {!search && !status && !priority && (
                <a
                  href="/cases/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white
                             text-sm font-semibold rounded-xl hover:bg-surface-tint transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  New Case
                </a>
              )}
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/40">
              {filtered.map((c, idx) => (
                <div
                  key={c.id}
                  onClick={() => { window.location.href = `/cases/${c.id}` }}
                  className={`
                    row-enter group grid grid-cols-[1fr_100px_130px_110px_36px] gap-4 px-5 py-4
                    hover:bg-surface-container-low/60 transition-colors duration-150 cursor-pointer
                    ${priorityBorderClass(c.priority)}
                  `}
                  style={{ animationDelay: `${idx * 35}ms` }}
                >
                  {/* Title + meta */}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-on-surface truncate leading-tight">{c.title}</p>
                    {c.description && (
                      <p className="text-xs text-on-surface-variant truncate mt-0.5 leading-relaxed">
                        {c.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      {c.assigned_to_name ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
                          <span className="w-4 h-4 rounded-full bg-secondary/20 border border-secondary/30
                                           flex items-center justify-center text-secondary text-[9px] font-bold">
                            {initials(c.assigned_to_name)}
                          </span>
                          {c.assigned_to_name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-outline">Unassigned</span>
                      )}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="flex items-start pt-0.5">
                    {priorityBadge(c.priority)}
                  </div>

                  {/* Status */}
                  <div className="flex items-start pt-0.5">
                    {statusBadge(c.status)}
                  </div>

                  {/* Date */}
                  <div className="flex items-start pt-1">
                    <span className="text-xs text-on-surface-variant whitespace-nowrap">
                      {formatDate(c.created_at)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-start pt-0.5">
                    <RowMenu caseItem={c} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-outline-variant/60 bg-surface-container-low/40
                            flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-on-surface-variant">
                  Showing <span className="font-semibold text-on-surface">{filtered.length}</span> of{" "}
                  <span className="font-semibold text-on-surface">{total}</span> cases
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Priority legend */}
                {(["critical", "high", "medium", "low"] as Priority[]).map(p => (
                  <span key={p} className="hidden lg:inline-flex items-center gap-1 text-[10px] text-on-surface-variant px-2">
                    <span className={`w-2 h-2 rounded-sm ${
                      p === "critical" ? "bg-red-400" :
                      p === "high"     ? "bg-orange-400" :
                      p === "medium"   ? "bg-amber-400" :
                                         "bg-blue-400"
                    }`} />
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="px-5 py-3 bg-error/5 border-t border-error/20">
              <p className="text-xs text-error">{error}</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
