import { useEffect, useState } from "react"
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  UserCircleIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  BeakerIcon,
  MagnifyingGlassIcon,
  DocumentChartBarIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline"
import { AppLayout } from "../components/AppLayout"
import { type Case, getCase, updateCase } from "../lib/api"

// ─── Visual helpers ───────────────────────────────────────────────────────────

type Priority = Case["priority"]
type Status   = Case["status"]

function priorityBadge(p: Priority) {
  const map: Record<Priority, string> = {
    critical: "bg-red-50 text-red-700 border border-red-200",
    high:     "bg-orange-50 text-orange-700 border border-orange-200",
    medium:   "bg-amber-50 text-amber-700 border border-amber-200",
    low:      "bg-blue-50 text-blue-700 border border-blue-200",
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold capitalize ${map[p] ?? map.medium}`}>
      {p}
    </span>
  )
}

function statusBadge(s: Status) {
  const map: Record<Status, { cls: string; dot: string; label: string }> = {
    open:        { cls: "bg-slate-100  text-slate-600",  dot: "bg-slate-400",  label: "Open"        },
    in_progress: { cls: "bg-teal-50    text-teal-700",   dot: "bg-teal-500",   label: "In Progress" },
    closed:      { cls: "bg-green-50   text-green-700",  dot: "bg-green-500",  label: "Closed"      },
    archived:    { cls: "bg-gray-100   text-gray-500",   dot: "bg-gray-400",   label: "Archived"    },
  }
  const { cls, dot, label } = map[s] ?? map.open
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot} ${s === "in_progress" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  )
}

function formatDate(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  })
}

function formatDateTime(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "evidence" | "findings" | "report"

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview",  label: "Overview",  icon: <DocumentTextIcon      className="w-4 h-4" /> },
  { id: "evidence",  label: "Evidence",  icon: <BeakerIcon             className="w-4 h-4" /> },
  { id: "findings",  label: "Findings",  icon: <MagnifyingGlassIcon    className="w-4 h-4" /> },
  { id: "report",    label: "Report",    icon: <DocumentChartBarIcon   className="w-4 h-4" /> },
]

// ─── Placeholder tab content ──────────────────────────────────────────────────

function PlaceholderTab({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center">
        <span className="text-outline [&>svg]:w-7 [&>svg]:h-7">{icon}</span>
      </div>
      <div>
        <p className="font-semibold text-on-surface">{label} coming soon</p>
        <p className="text-sm text-on-surface-variant mt-1">This section will be available in a future update.</p>
      </div>
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

interface OverviewTabProps {
  caseItem: Case
  editing:  boolean
  draft:    Partial<Case>
  onDraft:  (patch: Partial<Case>) => void
}

function OverviewTab({ caseItem, editing, draft, onDraft }: OverviewTabProps) {
  const title       = editing ? (draft.title       ?? caseItem.title)       : caseItem.title
  const description = editing ? (draft.description ?? caseItem.description) : caseItem.description

  const PRIORITY_OPTS: Priority[] = ["low", "medium", "high", "critical"]
  const STATUS_OPTS:   Status[]   = ["open", "in_progress", "closed", "archived"]

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Title</label>
        {editing ? (
          <input
            type="text"
            value={title as string}
            onChange={e => onDraft({ title: e.target.value })}
            maxLength={200}
            className="w-full h-11 px-4 bg-white border-2 border-secondary rounded-xl text-sm text-on-surface
                       focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
          />
        ) : (
          <p className="text-base font-semibold text-on-surface leading-relaxed">{title}</p>
        )}
      </div>

      {/* Priority + Status */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Priority</label>
          {editing ? (
            <div className="relative">
              <select
                value={draft.priority ?? caseItem.priority}
                onChange={e => onDraft({ priority: e.target.value as Priority })}
                className="w-full appearance-none h-10 pl-3 pr-8 border-2 border-secondary rounded-xl
                           text-sm text-on-surface focus:outline-none bg-white"
              >
                {PRIORITY_OPTS.map(p => (
                  <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
              <ChevronDownIcon className="w-4 h-4 text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            priorityBadge(caseItem.priority)
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Status</label>
          {editing ? (
            <div className="relative">
              <select
                value={draft.status ?? caseItem.status}
                onChange={e => onDraft({ status: e.target.value as Status })}
                className="w-full appearance-none h-10 pl-3 pr-8 border-2 border-secondary rounded-xl
                           text-sm text-on-surface focus:outline-none bg-white"
              >
                {STATUS_OPTS.map(s => (
                  <option key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
              <ChevronDownIcon className="w-4 h-4 text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            statusBadge(caseItem.status)
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Description</label>
        {editing ? (
          <textarea
            value={description as string}
            onChange={e => onDraft({ description: e.target.value })}
            rows={5}
            className="w-full px-4 py-3 bg-white border-2 border-secondary rounded-xl text-sm text-on-surface
                       resize-none focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
          />
        ) : description ? (
          <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{description}</p>
        ) : (
          <p className="text-sm text-outline italic">No description provided.</p>
        )}
      </div>

      {/* Timeline section */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Activity</label>
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low/40 p-4 space-y-4">
          {/* Case created */}
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <ClockIcon className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-on-surface">Case created</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                By <span className="font-medium">{caseItem.created_by_name ?? "Unknown"}</span>
                {" · "}{formatDateTime(caseItem.created_at)}
              </p>
            </div>
          </div>

          {/* Closed */}
          {caseItem.closed_at && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center shrink-0 mt-0.5">
                <CheckIcon className="w-3.5 h-3.5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-on-surface">Case closed</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{formatDateTime(caseItem.closed_at)}</p>
              </div>
            </div>
          )}

          {/* Last updated */}
          {caseItem.updated_at !== caseItem.created_at && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 mt-0.5">
                <PencilSquareIcon className="w-3.5 h-3.5 text-secondary" />
              </div>
              <div>
                <p className="text-sm font-medium text-on-surface">Last updated</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{formatDateTime(caseItem.updated_at)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <AppLayout>
      <div className="page-enter p-8 max-w-4xl mx-auto space-y-6">
        <div className="skeleton h-8 w-1/3" />
        <div className="skeleton h-12 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </AppLayout>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CaseDetailPage() {
  // Extract id from path: /cases/:id
  const id = window.location.pathname.split("/cases/")[1]?.split("/")[0]

  const [caseItem, setCaseItem] = useState<Case | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab,      setTab]      = useState<Tab>("overview")
  const [editing,  setEditing]  = useState(false)
  const [draft,    setDraft]    = useState<Partial<Case>>({})
  const [saving,   setSaving]   = useState(false)
  const [saveErr,  setSaveErr]  = useState<string | null>(null)

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return }
    getCase(id)
      .then(data => setCaseItem(data.case))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  function handleEdit() {
    setDraft({})
    setEditing(true)
    setSaveErr(null)
  }

  function handleCancel() {
    setEditing(false)
    setDraft({})
    setSaveErr(null)
  }

  async function handleSave() {
    if (!caseItem) return
    setSaving(true)
    setSaveErr(null)
    try {
      const data = await updateCase(caseItem.id, draft)
      setCaseItem(data.case)
      setEditing(false)
      setDraft({})
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Save failed. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton />

  if (notFound || !caseItem) {
    return (
      <AppLayout>
        <div className="page-enter flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center">
            <ExclamationTriangleIcon className="w-8 h-8 text-error" />
          </div>
          <div>
            <p className="font-bold text-on-surface text-lg">Case not found</p>
            <p className="text-sm text-on-surface-variant mt-1">The case may have been removed or you don't have access.</p>
          </div>
          <a href="/cases" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-surface-tint transition-colors">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Cases
          </a>
        </div>
      </AppLayout>
    )
  }

  const shortId = caseItem.id.slice(0, 8).toUpperCase()

  return (
    <AppLayout>
      <div className="page-enter min-h-full">

        {/* ── Sticky top bar ──────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-outline-variant/60">
          <div className="max-w-4xl mx-auto px-8 py-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mb-2">
              <a href="/cases" className="hover:text-secondary transition-colors">Cases</a>
              <span>/</span>
              <span className="font-mono font-medium text-on-surface">{shortId}</span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <a
                  href="/cases"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant
                             hover:bg-surface-container transition-colors shrink-0"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </a>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-bold text-on-surface leading-tight line-clamp-1">
                    {caseItem.title}
                  </h1>
                  {priorityBadge(caseItem.priority)}
                  {statusBadge(caseItem.status)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {editing ? (
                  <>
                    <button
                      onClick={handleCancel}
                      className="h-9 px-4 inline-flex items-center gap-1.5 text-sm font-semibold
                                 text-on-surface-variant border border-outline-variant rounded-xl
                                 hover:bg-surface-container transition-colors"
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || Object.keys(draft).length === 0}
                      className="h-9 px-4 inline-flex items-center gap-1.5 text-sm font-semibold
                                 bg-secondary text-white rounded-xl
                                 hover:brightness-110 transition-all
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <CheckIcon className="w-4 h-4" />
                      )}
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleEdit}
                    className="h-9 px-4 inline-flex items-center gap-1.5 text-sm font-semibold
                               text-on-surface border border-outline-variant rounded-xl
                               hover:bg-surface-container transition-colors"
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-8 py-6 space-y-6">

          {/* Save error */}
          {saveErr && (
            <div className="flex items-start gap-3 px-4 py-3 bg-error/8 border border-error/20 rounded-xl">
              <XMarkIcon className="w-4 h-4 text-error mt-0.5 shrink-0" />
              <p className="text-sm text-error">{saveErr}</p>
            </div>
          )}

          {/* Metadata strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                icon: <UserCircleIcon className="w-4 h-4 text-on-surface-variant" />,
                label: "Created by",
                value: caseItem.created_by_name ?? "Unknown",
              },
              {
                icon: <CalendarDaysIcon className="w-4 h-4 text-on-surface-variant" />,
                label: "Created",
                value: formatDate(caseItem.created_at),
              },
              {
                icon: <UserCircleIcon className="w-4 h-4 text-on-surface-variant" />,
                label: "Assigned to",
                value: caseItem.assigned_to_name ?? "Unassigned",
              },
              {
                icon: <ClockIcon className="w-4 h-4 text-on-surface-variant" />,
                label: "Last updated",
                value: formatDate(caseItem.updated_at),
              },
            ].map(({ icon, label, value }, i) => (
              <div
                key={i}
                className="card-enter flex items-start gap-2.5 p-3.5 bg-white rounded-xl
                           border border-outline-variant/60"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="mt-0.5 shrink-0">{icon}</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-semibold text-on-surface mt-0.5 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="border-b border-outline-variant/60">
            <div className="flex gap-0.5">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2
                              transition-all duration-150
                              ${tab === t.id
                                ? "border-secondary text-secondary"
                                : "border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant"
                              }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="bg-white rounded-2xl border border-outline-variant/60 p-6 shadow-sm">
            {tab === "overview" && (
              <OverviewTab
                caseItem={caseItem}
                editing={editing}
                draft={draft}
                onDraft={patch => setDraft(prev => ({ ...prev, ...patch }))}
              />
            )}
            {tab === "evidence" && (
              <PlaceholderTab label="Evidence" icon={<BeakerIcon className="w-7 h-7" />} />
            )}
            {tab === "findings" && (
              <PlaceholderTab label="Findings" icon={<MagnifyingGlassIcon className="w-7 h-7" />} />
            )}
            {tab === "report" && (
              <PlaceholderTab label="Report" icon={<DocumentChartBarIcon className="w-7 h-7" />} />
            )}
          </div>

          {/* Archive zone */}
          {!editing && caseItem.status !== "archived" && (
            <div className="flex items-center justify-between px-5 py-4 bg-surface-container-low/60
                            rounded-xl border border-outline-variant/40">
              <div>
                <p className="text-sm font-semibold text-on-surface">Archive this case</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Archived cases are read-only and excluded from active views.
                </p>
              </div>
              <button
                onClick={() => handleSave()}
                className="inline-flex items-center gap-2 h-9 px-4 text-sm font-semibold
                           text-on-surface-variant border border-outline-variant rounded-xl
                           hover:bg-surface-container transition-colors"
              >
                <ArchiveBoxIcon className="w-4 h-4" />
                Archive
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
