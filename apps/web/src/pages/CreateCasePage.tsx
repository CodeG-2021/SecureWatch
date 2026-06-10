import { useState } from "react"
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  FireIcon,
  BoltIcon,
  MinusCircleIcon,
  ArrowDownCircleIcon,
  CheckCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid"
import { AppLayout } from "../components/AppLayout"
import { createCase } from "../lib/api"

// ─── Priority card config ─────────────────────────────────────────────────────

type Priority = "low" | "medium" | "high" | "critical"

interface PriorityOption {
  value:       Priority
  label:       string
  description: string
  icon:        React.ReactNode
  colors: {
    ring:   string
    bg:     string
    badge:  string
    icon:   string
  }
}

const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    value: "low",
    label: "Low",
    description: "Routine investigation, no immediate risk",
    icon: <ArrowDownCircleIcon className="w-6 h-6" />,
    colors: {
      ring:  "ring-2 ring-blue-400",
      bg:    "bg-blue-50/80",
      badge: "bg-blue-100 text-blue-700",
      icon:  "text-blue-500",
    },
  },
  {
    value: "medium",
    label: "Medium",
    description: "Standard monitoring and response",
    icon: <MinusCircleIcon className="w-6 h-6" />,
    colors: {
      ring:  "ring-2 ring-amber-400",
      bg:    "bg-amber-50/80",
      badge: "bg-amber-100 text-amber-700",
      icon:  "text-amber-500",
    },
  },
  {
    value: "high",
    label: "High",
    description: "Elevated threat, prioritised response",
    icon: <BoltIcon className="w-6 h-6" />,
    colors: {
      ring:  "ring-2 ring-orange-400",
      bg:    "bg-orange-50/80",
      badge: "bg-orange-100 text-orange-700",
      icon:  "text-orange-500",
    },
  },
  {
    value: "critical",
    label: "Critical",
    description: "Immediate escalation required",
    icon: <FireIcon className="w-6 h-6" />,
    colors: {
      ring:  "ring-2 ring-red-400",
      bg:    "bg-red-50/80",
      badge: "bg-red-100 text-red-700",
      icon:  "text-red-500",
    },
  },
]

// ─── Priority card ────────────────────────────────────────────────────────────

function PriorityCard({
  option,
  selected,
  onSelect,
}: {
  option:   PriorityOption
  selected: boolean
  onSelect: () => void
}) {
  const { colors } = option
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left
        transition-all duration-200 w-full
        ${selected
          ? `${colors.ring} ${colors.bg} border-transparent shadow-md scale-[1.02]`
          : "border-outline-variant/60 bg-white hover:border-outline hover:shadow-sm hover:scale-[1.01]"
        }
      `}
    >
      {/* Checkmark overlay */}
      {selected && (
        <span className="absolute top-2.5 right-2.5">
          <CheckCircleSolid className={`w-4 h-4 ${colors.icon}`} />
        </span>
      )}

      {/* Icon */}
      <div className={`transition-colors ${selected ? colors.icon : "text-outline"}`}>
        {option.icon}
      </div>

      {/* Label */}
      <div>
        <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded-md ${
          selected ? colors.badge : "bg-surface-container text-on-surface-variant"
        }`}>
          {option.label}
        </span>
        <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
          {option.description}
        </p>
      </div>
    </button>
  )
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessBanner({ caseId }: { caseId: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-outline-variant p-8 mx-4 max-w-sm w-full
                      text-center card-enter">
        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircleIcon className="w-9 h-9 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-on-surface">Case Created</h3>
        <p className="text-sm text-on-surface-variant mt-2">Your case has been successfully created.</p>
        <div className="flex gap-3 mt-6">
          <a
            href="/cases"
            className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm
                       font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            All Cases
          </a>
          <a
            href={`/cases/${caseId}`}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm
                       font-semibold hover:bg-surface-tint transition-colors"
          >
            Open Case
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CreateCasePage() {
  const [title,       setTitle]       = useState("")
  const [description, setDescription] = useState("")
  const [priority,    setPriority]    = useState<Priority>("medium")
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [createdId,   setCreatedId]   = useState<string | null>(null)

  const remaining = 200 - title.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError("Case title is required.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await createCase({ title: title.trim(), description: description.trim(), priority })
      setCreatedId(data.case.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create case. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="page-enter min-h-full">

        {createdId && <SuccessBanner caseId={createdId} />}

        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-outline-variant/60 px-8 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a
                href="/cases"
                className="w-8 h-8 flex items-center justify-center rounded-lg
                           text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4" />
              </a>
              <div>
                <h1 className="text-base font-bold text-on-surface leading-tight">New Case</h1>
                <p className="text-xs text-on-surface-variant">Start a new investigation</p>
              </div>
            </div>
            <button
              form="create-case-form"
              type="submit"
              disabled={loading || !title.trim()}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-xl bg-primary text-white
                         text-sm font-semibold hover:bg-surface-tint transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircleIcon className="w-4 h-4" />
              )}
              {loading ? "Creating…" : "Create Case"}
            </button>
          </div>
        </div>

        {/* ── Form ─────────────────────────────────────────────────────── */}
        <form
          id="create-case-form"
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto px-8 py-8 space-y-8"
        >
          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3 bg-error/8 border border-error/20 rounded-xl">
              <XMarkIcon className="w-4 h-4 text-error mt-0.5 shrink-0" />
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* ── Case title ───────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-on-surface">
              Case Title
              <span className="text-error ml-1">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Suspicious login activity on SRV-01"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
              required
              className="w-full h-11 px-4 bg-white border border-outline-variant rounded-xl
                         text-sm text-on-surface placeholder:text-outline
                         focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20
                         transition-all duration-150"
            />
            <p className={`text-xs text-right ${remaining < 20 ? "text-amber-600" : "text-outline"}`}>
              {remaining} characters remaining
            </p>
          </div>

          {/* ── Description ──────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-on-surface">
              Description
              <span className="text-outline font-normal ml-1">(optional)</span>
            </label>
            <textarea
              placeholder="Describe the incident, initial observations, scope…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-white border border-outline-variant rounded-xl
                         text-sm text-on-surface placeholder:text-outline resize-none
                         focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20
                         transition-all duration-150"
            />
          </div>

          {/* ── Priority ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-on-surface">
                Priority Level
                <span className="text-error ml-1">*</span>
              </label>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Determines urgency and escalation behaviour
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {PRIORITY_OPTIONS.map(opt => (
                <PriorityCard
                  key={opt.value}
                  option={opt}
                  selected={priority === opt.value}
                  onSelect={() => setPriority(opt.value)}
                />
              ))}
            </div>
          </div>

          {/* ── Warning note ─────────────────────────────────────────── */}
          {(priority === "critical" || priority === "high") && (
            <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border
              ${priority === "critical"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-orange-50 border-orange-200 text-orange-700"
              }`}>
              <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-xs font-medium">
                {priority === "critical"
                  ? "Critical cases trigger immediate notifications to all supervisors and admins."
                  : "High-priority cases will be flagged for expedited review."
                }
              </p>
            </div>
          )}

          {/* ── Submit (also in top bar, this is the footer version) ─── */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/60">
            <a
              href="/cases"
              className="h-10 px-5 inline-flex items-center text-sm font-semibold
                         text-on-surface-variant border border-outline-variant rounded-xl
                         hover:bg-surface-container transition-colors"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="h-10 px-5 inline-flex items-center gap-2 text-sm font-semibold
                         bg-primary text-white rounded-xl
                         hover:bg-surface-tint transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircleIcon className="w-4 h-4" />
              )}
              {loading ? "Creating…" : "Create Case"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
