import {
  FolderOpenIcon,
  UsersIcon,
  ShieldCheckIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  PlusIcon,
} from "@heroicons/react/24/outline"
import { AppLayout } from "../components/AppLayout"
import { getToken } from "../lib/session"

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

interface QuickStatProps {
  icon:  React.ReactNode
  label: string
  value: string | number
  sub:   string
  color: string
  delay: number
  href?: string
}

function QuickStat({ icon, label, value, sub, color, delay, href }: QuickStatProps) {
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
        {href && (
          <ArrowTrendingUpIcon className="w-4 h-4 text-outline opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-on-surface">{value}</p>
        <p className="text-sm font-medium text-on-surface mt-0.5">{label}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">{sub}</p>
      </div>
    </div>
  )
  return href ? <a href={href}>{inner}</a> : inner
}

export function DashboardPage() {
  const user = parseToken(getToken())

  return (
    <AppLayout>
      <div className="page-enter p-8 max-w-5xl mx-auto space-y-10">

        {/* ── Welcome header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">
              {greet(user.name)} 👋
            </h1>
            <p className="text-sm text-on-surface-variant mt-1.5">
              Here's what's happening in your workspace today.
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

        {/* ── Quick stats ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickStat
            icon={<FolderOpenIcon className="w-5 h-5 text-primary" />}
            label="Active Cases" value="—"
            sub="Pending investigation"
            color="bg-primary/10" delay={0} href="/cases"
          />
          <QuickStat
            icon={<BoltIcon className="w-5 h-5 text-red-600" />}
            label="Critical" value="—"
            sub="Require immediate action"
            color="bg-red-50" delay={60} href="/cases?priority=critical"
          />
          <QuickStat
            icon={<ClockIcon className="w-5 h-5 text-amber-600" />}
            label="In Progress" value="—"
            sub="Under investigation"
            color="bg-amber-50" delay={120} href="/cases?status=in_progress"
          />
          <QuickStat
            icon={<UsersIcon className="w-5 h-5 text-teal-600" />}
            label="Team" value="—"
            sub="Active analysts"
            color="bg-teal-50" delay={180} href="/users"
          />
        </div>

        {/* ── My profile card ─────────────────────────────────────────── */}
        <div className="card-enter bg-white rounded-2xl border border-outline-variant/60 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-secondary to-teal-400" />
          <div className="p-6 flex items-center gap-5">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-[#0d1628] flex items-center justify-center shrink-0">
              <ShieldCheckIcon className="w-7 h-7 text-secondary" />
            </div>
            {/* Info */}
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
            {/* Quick links */}
            <div className="flex flex-col gap-2 shrink-0">
              <a
                href="/cases"
                className="inline-flex items-center gap-2 h-9 px-4 text-sm font-semibold text-on-surface
                           border border-outline-variant rounded-xl hover:bg-surface-container transition-colors"
              >
                <FolderOpenIcon className="w-4 h-4" />
                My Cases
              </a>
            </div>
          </div>
        </div>

        {/* ── Getting started ─────────────────────────────────────────── */}
        <div className="card-enter space-y-3" style={{ animationDelay: "240ms" }}>
          <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { href: "/cases/new", icon: <PlusIcon className="w-5 h-5" />,         label: "Create Case",   desc: "Start a new investigation" },
              { href: "/cases",     icon: <FolderOpenIcon className="w-5 h-5" />,    label: "Browse Cases",  desc: "View all open cases"        },
              { href: "/users",     icon: <UsersIcon className="w-5 h-5" />,         label: "Manage Team",   desc: "Users & roles"              },
            ].map(({ href, icon, label, desc }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-outline-variant/60
                           hover:border-secondary/40 hover:shadow-sm hover:-translate-y-0.5
                           transition-all duration-150 group"
              >
                <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center
                                text-on-surface-variant group-hover:bg-secondary/10 group-hover:text-secondary
                                transition-all shrink-0">
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">{label}</p>
                  <p className="text-xs text-on-surface-variant">{desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
