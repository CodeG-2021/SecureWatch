import { useEffect, useState } from "react"
import {
  FolderOpenIcon,
  UsersIcon,
  ShieldCheckIcon,
  ClockIcon,
  BoltIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentMagnifyingGlassIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline"
import { AppLayout } from "../components/AppLayout"
import { getToken } from "../lib/session"
import { type DashboardMetrics, getDashboardMetrics } from "../lib/api"

function parseToken(token: string | null) {
  if (!token) return { name: "Agent", email: "", role: "analyst" }
  try {
    const p = JSON.parse(atob(token.split(".")[1]))
    return { name: p.name ?? "Agent", email: p.email ?? "", role: p.role ?? "analyst" }
  } catch {
    return { name: "Agent", email: "", role: "analyst" }
  }
}

function greet(name: string) {
  const h = new Date().getHours()
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
  return `${part}, ${name.split(" ")[0]}`
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon:    React.ReactNode
  label:   string
  value:   number | string
  sub:     string
  color:   string
  delay:   number
  href?:   string
  loading: boolean
}

function StatCard({ icon, label, value, sub, color, delay, href, loading }: StatCardProps) {
  const inner = (
    <div
      className={`card-enter group bg-white rounded-2xl border border-outline-variant/60 p-5
                  hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
                  ${href ? "cursor-pointer" : "cursor-default"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="skeleton h-8 w-16 rounded mb-1" />
        ) : (
          <p className="text-2xl font-bold text-on-surface">{value}</p>
        )}
        <p className="text-sm font-medium text-on-surface mt-0.5">{label}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">{sub}</p>
      </div>
    </div>
  )
  return href ? <a href={href}>{inner}</a> : inner
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────

interface BarChartProps {
  data:    { label: string; value: number; color: string }[]
  total:   number
  loading: boolean
}

function BarChart({ data, total, loading }: BarChartProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton flex-1 h-5 rounded-md" />
            <div className="skeleton h-3 w-6 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {data.map(({ label, value, color }) => {
        const pct = total > 0 ? (value / total) * 100 : 0
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="text-xs text-on-surface-variant w-20 shrink-0 text-right">{label}</span>
            <div className="flex-1 h-5 bg-surface-container rounded-md overflow-hidden">
              <div
                className={`h-full rounded-md transition-all duration-500 ${color}`}
                style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-on-surface w-6 text-right">{value}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ value, total, color, loading }: { value: number; total: number; color: string; loading: boolean }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const r = 28
  const circumference = 2 * Math.PI * r
  const dash = (pct / 100) * circumference

  if (loading) return <div className="skeleton w-20 h-20 rounded-full mx-auto" />

  return (
    <div className="relative w-20 h-20 mx-auto">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="5"
                className="text-outline-variant/20" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5"
                className={color}
                strokeDasharray={`${dash} ${circumference}`}
                strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-on-surface leading-none">{pct}%</span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const user = parseToken(getToken())
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardMetrics()
      .then(setMetrics)
      .catch(() => {/* metrics stay null — show skeletons */})
      .finally(() => setLoading(false))
  }, [])

  const m = metrics

  return (
    <AppLayout>
      <div className="page-enter p-8 max-w-6xl mx-auto space-y-8">

        {/* ── Welcome header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">
              {greet(user.name)} 👋
            </h1>
            <p className="text-sm text-on-surface-variant mt-1.5">
              Platform-wide status at a glance.
            </p>
          </div>
          <a
            href="/cases/new"
            className="inline-flex items-center gap-2 h-10 px-4 shrink-0
                       bg-primary text-white text-sm font-semibold rounded-xl
                       hover:bg-surface-tint transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New Case
          </a>
        </div>

        {/* ── Top stat cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard loading={loading}
            icon={<FolderOpenIcon className="w-5 h-5 text-primary" />}
            label="Total Cases" value={m?.cases.total ?? 0}
            sub={`${m?.cases.open ?? 0} open · ${m?.cases.in_progress ?? 0} in progress`}
            color="bg-primary/10" delay={0} href="/cases"
          />
          <StatCard loading={loading}
            icon={<BoltIcon className="w-5 h-5 text-red-600" />}
            label="Critical Cases" value={m?.cases.critical ?? 0}
            sub="Require immediate action"
            color="bg-red-50" delay={60} href="/cases?priority=critical"
          />
          <StatCard loading={loading}
            icon={<DocumentMagnifyingGlassIcon className="w-5 h-5 text-violet-600" />}
            label="Total Findings" value={m?.findings.total ?? 0}
            sub={`${m?.findings.critical ?? 0} critical · ${m?.findings.high ?? 0} high`}
            color="bg-violet-50" delay={120}
          />
          <StatCard loading={loading}
            icon={<CheckCircleIcon className="w-5 h-5 text-teal-600" />}
            label="Evidences Processed" value={m?.evidences.completed ?? 0}
            sub={`${m?.evidences.total ?? 0} total · ${m?.evidences.failed ?? 0} failed`}
            color="bg-teal-50" delay={180}
          />
        </div>

        {/* ── Charts row ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Cases by status */}
          <div className="bg-white rounded-2xl border border-outline-variant/60 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FolderOpenIcon className="w-4 h-4 text-on-surface-variant" />
              <h3 className="text-sm font-bold text-on-surface">Cases by Status</h3>
            </div>
            <BarChart loading={loading} total={m?.cases.total ?? 1} data={[
              { label: "Open",        value: m?.cases.open        ?? 0, color: "bg-blue-400"   },
              { label: "In Progress", value: m?.cases.in_progress ?? 0, color: "bg-teal-400"   },
              { label: "Closed",      value: m?.cases.closed      ?? 0, color: "bg-green-400"  },
              { label: "Archived",    value: m?.cases.archived    ?? 0, color: "bg-slate-300"  },
            ]} />
          </div>

          {/* Findings by severity */}
          <div className="bg-white rounded-2xl border border-outline-variant/60 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-on-surface-variant" />
              <h3 className="text-sm font-bold text-on-surface">Findings by Severity</h3>
            </div>
            <BarChart loading={loading} total={m?.findings.total ?? 1} data={[
              { label: "Critical", value: m?.findings.critical ?? 0, color: "bg-red-500"    },
              { label: "High",     value: m?.findings.high     ?? 0, color: "bg-orange-400" },
              { label: "Medium",   value: m?.findings.medium   ?? 0, color: "bg-amber-400"  },
              { label: "Low",      value: m?.findings.low      ?? 0, color: "bg-blue-400"   },
            ]} />
          </div>

          {/* Tasks completion ring */}
          <div className="bg-white rounded-2xl border border-outline-variant/60 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ArrowPathIcon className="w-4 h-4 text-on-surface-variant" />
              <h3 className="text-sm font-bold text-on-surface">Task Completion</h3>
            </div>
            <ProgressRing
              loading={loading}
              value={m?.tasks.completed ?? 0}
              total={m?.tasks.total ?? 1}
              color="stroke-teal-500"
            />
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              {[
                { label: "Completed",  value: m?.tasks.completed  ?? 0, cls: "text-teal-700 bg-teal-50"   },
                { label: "Failed",     value: m?.tasks.failed     ?? 0, cls: "text-red-700 bg-red-50"     },
                { label: "Processing", value: m?.tasks.processing ?? 0, cls: "text-amber-700 bg-amber-50" },
                { label: "Pending",    value: m?.tasks.pending    ?? 0, cls: "text-blue-700 bg-blue-50"   },
              ].map(({ label, value, cls }) => (
                <div key={label} className={`rounded-lg py-2 px-1 ${cls}`}>
                  {loading ? <div className="skeleton h-4 w-8 mx-auto rounded" /> : (
                    <p className="font-bold text-base leading-none">{value}</p>
                  )}
                  <p className="mt-1 opacity-80">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Profile + quick actions ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Profile card */}
          <div className="card-enter bg-white rounded-2xl border border-outline-variant/60 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary via-secondary to-teal-400" />
            <div className="p-6 flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-[#0d1628] flex items-center justify-center shrink-0">
                <ShieldCheckIcon className="w-7 h-7 text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-on-surface">{user.name}</p>
                <p className="text-sm text-on-surface-variant truncate">{user.email}</p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="inline-block px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold
                                   rounded-md uppercase tracking-wide">
                    {user.role}
                  </span>
                  <span className="text-xs text-on-surface-variant">SecureWatch Platform</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="card-enter bg-white rounded-2xl border border-outline-variant/60 p-5">
            <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-2">
              {[
                { href: "/cases/new", icon: <PlusIcon className="w-4 h-4" />,                    label: "Create Case",      desc: "Start a new investigation" },
                { href: "/cases",     icon: <FolderOpenIcon className="w-4 h-4" />,               label: "Browse Cases",     desc: "View all open cases"        },
                { href: "/users",     icon: <UsersIcon className="w-4 h-4" />,                    label: "Manage Team",      desc: "Users & roles"              },
                { href: "/cases?status=in_progress", icon: <ClockIcon className="w-4 h-4" />,     label: "In-Progress Cases",desc: "Review active investigations"},
              ].map(({ href, icon, label, desc }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/40
                             hover:border-secondary/40 hover:bg-surface-container-low/60
                             transition-all duration-150 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center
                                  text-on-surface-variant group-hover:bg-secondary/10 group-hover:text-secondary
                                  transition-all shrink-0">
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface">{label}</p>
                    <p className="text-xs text-on-surface-variant">{desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  )
}
