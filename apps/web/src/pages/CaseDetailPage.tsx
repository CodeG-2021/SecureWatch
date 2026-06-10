import { useCallback, useEffect, useRef, useState } from "react"
import { useCaseStream } from "../lib/useCaseStream"
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
  ChevronDownIcon,
  ExclamationTriangleIcon,
  ArchiveBoxIcon,
  ArrowUpTrayIcon,
  DocumentIcon,
  PhotoIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon as ArchiveFileIcon,
  CodeBracketIcon,
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline"
import { AppLayout } from "../components/AppLayout"
import { type Case, type Evidence, type Finding, type Report, getCase, updateCase, uploadEvidence, listEvidences, listFindings, generateReport, getReport } from "../lib/api"

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

type Tab = "overview" | "evidence" | "findings"

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview",  label: "Overview",  icon: <DocumentTextIcon      className="w-4 h-4" /> },
  { id: "evidence",  label: "Evidence",  icon: <BeakerIcon             className="w-4 h-4" /> },
  { id: "findings",  label: "Findings",  icon: <MagnifyingGlassIcon    className="w-4 h-4" /> },
]

// ─── Placeholder tab content ──────────────────────────────────────────────────


// ─── Evidence helpers ─────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function FileTypeIcon({ type }: { type: Evidence["file_type"] }) {
  const base = "w-5 h-5"
  switch (type) {
    case "image":    return <PhotoIcon      className={`${base} text-violet-500`} />
    case "audio":    return <MusicalNoteIcon className={`${base} text-pink-500`} />
    case "document": return <DocumentIcon   className={`${base} text-blue-500`} />
    case "archive":  return <ArchiveFileIcon className={`${base} text-amber-500`} />
    case "text":     return <CodeBracketIcon className={`${base} text-emerald-500`} />
    default:         return <DocumentIcon   className={`${base} text-on-surface-variant`} />
  }
}

function EvidenceStatusBadge({ status }: { status: Evidence["status"] }) {
  const map: Record<Evidence["status"], { cls: string; label: string }> = {
    uploaded:   { cls: "bg-blue-50 text-blue-700",   label: "Uploaded"   },
    classified: { cls: "bg-teal-50 text-teal-700",   label: "Classified" },
    queued:     { cls: "bg-amber-50 text-amber-700", label: "Queued"     },
    processing: { cls: "bg-purple-50 text-purple-700 animate-pulse", label: "Processing" },
    completed:  { cls: "bg-green-50 text-green-700", label: "Completed"  },
    failed:     { cls: "bg-red-50 text-red-700",     label: "Failed"     },
  }
  const { cls, label } = map[status] ?? map.uploaded
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  )
}

// ─── Evidence tab ─────────────────────────────────────────────────────────────

function EvidenceTab({ caseId, refreshTrigger }: { caseId: string; refreshTrigger?: number }) {
  const [evidences,    setEvidences]    = useState<Evidence[]>([])
  const [loading,      setLoading]      = useState(true)
  const [uploading,    setUploading]    = useState(false)
  const [progress,     setProgress]     = useState(0)
  const [uploadErr,    setUploadErr]    = useState<string | null>(null)
  const [dragOver,     setDragOver]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadEvidences = useCallback(() => {
    listEvidences(caseId)
      .then(d => setEvidences(d.evidences))
      .catch(() => setEvidences([]))
      .finally(() => setLoading(false))
  }, [caseId])

  useEffect(() => { loadEvidences() }, [loadEvidences])
  // Re-fetch when a real-time event signals a change
  useEffect(() => { if (refreshTrigger) loadEvidences() }, [refreshTrigger, loadEvidences])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]

    setUploading(true)
    setProgress(0)
    setUploadErr(null)

    try {
      const ev = await uploadEvidence(caseId, file, pct => setProgress(pct))
      setEvidences(prev => [ev, ...prev])
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed. Please try again.")
    } finally {
      setUploading(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setDragOver(true) }
  function onDragLeave()                  { setDragOver(false) }
  function onDrop(e: React.DragEvent)     { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }

  return (
    <div className="space-y-6">

      {/* ── Upload zone ─────────────────────────────────────────── */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-3 py-10 px-6
          rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200
          ${dragOver
            ? "border-secondary bg-secondary/5 scale-[1.01]"
            : "border-outline-variant/70 hover:border-secondary/60 hover:bg-surface-container-low/50"
          }
          ${uploading ? "pointer-events-none opacity-75" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />

        {uploading ? (
          <div className="w-full max-w-xs space-y-3 text-center">
            <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto">
              <ArrowUpTrayIcon className="w-5 h-5 text-secondary animate-bounce" />
            </div>
            <p className="text-sm font-semibold text-on-surface">Uploading…</p>
            <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-on-surface-variant">{progress}%</p>
          </div>
        ) : (
          <>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
              ${dragOver ? "bg-secondary/20" : "bg-surface-container"}`}>
              <ArrowUpTrayIcon className={`w-6 h-6 transition-colors ${dragOver ? "text-secondary" : "text-on-surface-variant"}`} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-on-surface">
                Drop a file here, or <span className="text-secondary">click to browse</span>
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                Images, audio, documents, archives · up to 100 MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Upload error */}
      {uploadErr && (
        <div className="flex items-start gap-3 px-4 py-3 bg-error/8 border border-error/20 rounded-xl">
          <XMarkIcon className="w-4 h-4 text-error mt-0.5 shrink-0" />
          <p className="text-sm text-error">{uploadErr}</p>
          <button onClick={() => setUploadErr(null)} className="ml-auto text-error/60 hover:text-error transition-colors">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Evidence list ────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-xl" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : evidences.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <BeakerIcon className="w-10 h-10 text-outline/60" />
          <div>
            <p className="text-sm font-semibold text-on-surface">No evidence yet</p>
            <p className="text-xs text-on-surface-variant mt-1">Upload your first file to get started.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
            {evidences.length} file{evidences.length !== 1 ? "s" : ""}
          </p>
          {evidences.map((ev, i) => (
            <div
              key={ev.id}
              className="row-enter flex items-center gap-3 px-4 py-3 rounded-xl
                         border border-outline-variant/50 bg-surface-container-low/40
                         hover:bg-surface-container/70 transition-colors group"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Type icon */}
              <div className="w-9 h-9 rounded-lg bg-white border border-outline-variant/50
                              flex items-center justify-center shrink-0">
                <FileTypeIcon type={ev.file_type} />
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{ev.original_filename}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {formatBytes(ev.size_bytes)}
                  <span className="mx-1.5 text-outline">·</span>
                  <span className="capitalize">{ev.file_type}</span>
                  {ev.uploaded_by_name && (
                    <>
                      <span className="mx-1.5 text-outline">·</span>
                      {ev.uploaded_by_name}
                    </>
                  )}
                </p>
              </div>

              {/* Status */}
              <EvidenceStatusBadge status={ev.status} />

              {/* Hash (truncated) — visible on hover */}
              <span className="hidden group-hover:inline-block text-[10px] font-mono text-outline
                               truncate max-w-[120px]" title={ev.hash_sha256}>
                {ev.hash_sha256.slice(0, 12)}…
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Findings tab ─────────────────────────────────────────────────────────────

function severityConfig(s: Finding["severity"]) {
  const map = {
    critical: { cls: "bg-red-50 text-red-700 border border-red-200",    dot: "bg-red-500",    label: "Critical" },
    high:     { cls: "bg-orange-50 text-orange-700 border border-orange-200", dot: "bg-orange-500", label: "High" },
    medium:   { cls: "bg-amber-50 text-amber-700 border border-amber-200",   dot: "bg-amber-500",  label: "Medium" },
    low:      { cls: "bg-blue-50 text-blue-700 border border-blue-200",      dot: "bg-blue-400",   label: "Low" },
  }
  return map[s] ?? map.low
}

function findingTypeLabel(t: string) {
  const labels: Record<string, string> = {
    transcription:          "Transcription",
    transcription_warning:  "Audio Warning",
    risk:                   "Risk Match",
    entities:               "Entities",
    keywords:               "Keywords",
    image_objects:          "Objects Detected",
    image_metadata:         "Image Metadata",
    document_metadata:      "Document Metadata",
    document_text:          "Document Text",
    archive_contents:       "Archive Contents",
    suspicious_file:        "Suspicious File",
  }
  return labels[t] ?? t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function FindingsTab({ caseId, refreshTrigger }: { caseId: string; refreshTrigger?: number }) {
  const [findings,   setFindings]   = useState<Finding[]>([])
  const [loading,    setLoading]    = useState(true)
  const [expanded,   setExpanded]   = useState<string | null>(null)

  const loadFindings = useCallback(() => {
    listFindings(caseId)
      .then(d => setFindings(d.findings ?? []))
      .catch(() => setFindings([]))
      .finally(() => setLoading(false))
  }, [caseId])

  useEffect(() => { loadFindings() }, [loadFindings])
  useEffect(() => { if (refreshTrigger) loadFindings() }, [refreshTrigger, loadFindings])

  const bySeverity = ["critical", "high", "medium", "low"] as const
  const counts = bySeverity.reduce((acc, s) => {
    acc[s] = findings.filter(f => f.severity === s).length
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-14 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    )
  }

  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center">
          <MagnifyingGlassIcon className="w-7 h-7 text-outline/60" />
        </div>
        <div>
          <p className="text-sm font-semibold text-on-surface">No findings yet</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Upload evidence and wait for the workers to process it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Summary strip ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {bySeverity.map(s => {
          const { cls, dot, label } = severityConfig(s)
          return (
            <div key={s} className={`flex flex-col items-center gap-1 p-3 rounded-xl border ${cls}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
              <span className="text-xl font-bold">{counts[s]}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
            </div>
          )
        })}
      </div>

      {/* ── Findings list ─────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
          {findings.length} finding{findings.length !== 1 ? "s" : ""}
        </p>

        {findings.map((f, i) => {
          const { cls, dot } = severityConfig(f.severity)
          const isOpen = expanded === f.id
          return (
            <div
              key={f.id}
              className="row-enter rounded-xl border border-outline-variant/50 overflow-hidden"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {/* Header row */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3
                           bg-surface-container-low/40 hover:bg-surface-container/70
                           transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : f.id)}
              >
                {/* Severity dot */}
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{f.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    <span className="capitalize">{findingTypeLabel(f.finding_type)}</span>
                    {f.evidence_filename && (
                      <>
                        <span className="mx-1.5 text-outline">·</span>
                        {f.evidence_filename}
                      </>
                    )}
                  </p>
                </div>

                {/* Severity badge */}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0 ${cls}`}>
                  {f.severity}
                </span>

                {/* Expand chevron */}
                <ChevronDownIcon className={`w-4 h-4 text-outline shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-4 pb-4 pt-2 border-t border-outline-variant/30 bg-white space-y-3">
                  {f.description && (
                    <p className="text-sm text-on-surface leading-relaxed">{f.description}</p>
                  )}
                  {f.data && Object.keys(f.data).length > 0 && (
                    <pre className="text-[11px] font-mono bg-surface-container-low p-3 rounded-lg
                                    overflow-x-auto max-h-48 text-on-surface-variant leading-relaxed">
                      {JSON.stringify(f.data, null, 2)}
                    </pre>
                  )}
                  <p className="text-[10px] text-outline">
                    {new Date(f.created_at).toLocaleString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
            </div>
          )
        })}
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

  const [caseItem,       setCaseItem]       = useState<Case | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [notFound,       setNotFound]       = useState(false)
  const [tab,            setTab]            = useState<Tab>("overview")
  const [editing,        setEditing]        = useState(false)
  const [draft,          setDraft]          = useState<Partial<Case>>({})
  const [saving,         setSaving]         = useState(false)
  const [saveErr,        setSaveErr]        = useState<string | null>(null)
  const [report,         setReport]         = useState<Report | null>(null)
  const [generatingRpt,  setGeneratingRpt]  = useState(false)
  const [reportErr,      setReportErr]      = useState<string | null>(null)
  const [evidenceRefresh, setEvidenceRefresh] = useState(0)
  const [findingRefresh,  setFindingRefresh]  = useState(0)

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return }
    getCase(id)
      .then(data => {
        setCaseItem(data.case)
        return getReport(id)
      })
      .then(rep => { if (rep) setReport(rep.report) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  // HU-25: real-time updates via SSE
  useCaseStream(id, {
    onTaskUpdated:     () => setEvidenceRefresh(n => n + 1),
    onEvidenceUpdated: () => setEvidenceRefresh(n => n + 1),
    onFindingCreated:  () => setFindingRefresh(n => n + 1),
    onRiskUpdated: (e) => setCaseItem(prev =>
      prev ? { ...prev, risk_score: e.risk_score, findings_count: e.findings_count } : prev
    ),
  })

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

  async function handleGenerateReport() {
    if (!caseItem) return
    setGeneratingRpt(true)
    setReportErr(null)
    try {
      const data = await generateReport(caseItem.id)
      setReport(data.report)
      // Don't use window.open — popup blockers kill async-triggered tabs.
      // The "Open Report" button appears immediately after generation.
    } catch (err) {
      setReportErr(err instanceof Error ? err.message : "Report generation failed.")
    } finally {
      setGeneratingRpt(false)
    }
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
                  <>
                    {/* Report download — always visible once generated */}
                    {report?.download_url && (
                      <a
                        href={report.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 px-4 inline-flex items-center gap-1.5 text-sm font-semibold
                                   text-teal-700 border border-teal-300 bg-teal-50 rounded-xl
                                   hover:bg-teal-100 transition-colors"
                        title={`Report from ${new Date(report.created_at).toLocaleDateString()}`}
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Report
                      </a>
                    )}
                    {/* Generate — only when no report exists yet */}
                    {!report && (
                      <button
                        onClick={handleGenerateReport}
                        disabled={generatingRpt}
                        className="h-9 px-4 inline-flex items-center gap-1.5 text-sm font-semibold
                                   text-violet-700 border border-violet-300 bg-violet-50 rounded-xl
                                   hover:bg-violet-100 transition-colors disabled:opacity-60"
                      >
                        {generatingRpt ? (
                          <span className="w-4 h-4 border-2 border-violet-400/40 border-t-violet-600 rounded-full animate-spin" />
                        ) : (
                          <DocumentArrowDownIcon className="w-4 h-4" />
                        )}
                        {generatingRpt ? "Generating…" : "Generate Report"}
                      </button>
                    )}
                    {/* Regenerate — only when case was updated after the last report */}
                    {report && caseItem && new Date(caseItem.updated_at) > new Date(report.created_at) && (
                      <button
                        onClick={handleGenerateReport}
                        disabled={generatingRpt}
                        className="h-9 px-4 inline-flex items-center gap-1.5 text-sm font-semibold
                                   text-amber-700 border border-amber-300 bg-amber-50 rounded-xl
                                   hover:bg-amber-100 transition-colors disabled:opacity-60"
                        title="Case was updated after the last report"
                      >
                        {generatingRpt ? (
                          <span className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-600 rounded-full animate-spin" />
                        ) : (
                          <DocumentArrowDownIcon className="w-4 h-4" />
                        )}
                        {generatingRpt ? "Generating…" : "Regenerate"}
                      </button>
                    )}
                    <button
                      onClick={handleEdit}
                      className="h-9 px-4 inline-flex items-center gap-1.5 text-sm font-semibold
                                 text-on-surface border border-outline-variant rounded-xl
                                 hover:bg-surface-container transition-colors"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-8 py-6 space-y-6">

          {/* Report error */}
          {reportErr && (
            <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
              <p className="text-sm text-orange-700">{reportErr}</p>
              <button onClick={() => setReportErr(null)} className="text-orange-400 hover:text-orange-600 ml-4">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Save error */}
          {saveErr && (
            <div className="flex items-start gap-3 px-4 py-3 bg-error/8 border border-error/20 rounded-xl">
              <XMarkIcon className="w-4 h-4 text-error mt-0.5 shrink-0" />
              <p className="text-sm text-error">{saveErr}</p>
            </div>
          )}

          {/* Metadata strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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

            {/* Risk score card */}
            {(() => {
              const score = caseItem.risk_score ?? 0
              const count = caseItem.findings_count ?? 0
              const pct   = Math.round(score)
              const { bar, ring, label, textColor } =
                pct >= 75 ? { bar: "bg-red-500",    ring: "stroke-red-500",    label: "High Risk",    textColor: "text-red-700"    } :
                pct >= 50 ? { bar: "bg-orange-500", ring: "stroke-orange-500", label: "Medium Risk",  textColor: "text-orange-700" } :
                pct >= 25 ? { bar: "bg-amber-500",  ring: "stroke-amber-500",  label: "Low Risk",     textColor: "text-amber-700"  } :
                count > 0 ? { bar: "bg-blue-400",   ring: "stroke-blue-400",   label: "Minimal Risk", textColor: "text-blue-700"   } :
                            { bar: "bg-slate-300",  ring: "stroke-slate-300",  label: "No Findings",  textColor: "text-slate-500"  }
              const circumference = 2 * Math.PI * 20
              const dash = (pct / 100) * circumference
              return (
                <div className="card-enter flex items-center gap-3 p-3.5 bg-white rounded-xl border border-outline-variant/60"
                     style={{ animationDelay: "200ms" }}>
                  {/* Ring */}
                  <div className="relative shrink-0 w-12 h-12">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4"
                              className="text-outline-variant/20" />
                      <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4"
                              className={ring}
                              strokeDasharray={`${dash} ${circumference}`}
                              strokeLinecap="round" />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold ${textColor}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Risk Score</p>
                    <p className={`text-sm font-bold mt-0.5 ${textColor}`}>{label}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">{count} finding{count !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              )
            })()}
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
              <EvidenceTab caseId={caseItem.id} refreshTrigger={evidenceRefresh} />
            )}
            {tab === "findings" && (
              <FindingsTab caseId={caseItem.id} refreshTrigger={findingRefresh} />
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
                onClick={async () => {
                  if (!caseItem) return
                  setSaving(true)
                  try {
                    const data = await updateCase(caseItem.id, { status: "archived" })
                    setCaseItem(data.case)
                  } finally {
                    setSaving(false)
                  }
                }}
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
