import {
  HomeIcon,
  FolderOpenIcon,
  UsersIcon,
  DocumentMagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  PlusCircleIcon,
  ArrowRightStartOnRectangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline"
import { clearSession, getToken } from "../lib/session"

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>
  label: string
  href: string
  roles?: string[]
}

interface NavSection {
  title?: string
  items: NavItem[]
}

// ─── Navigation map ───────────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { icon: HomeIcon,        label: "Dashboard", href: "/dashboard" },
      { icon: FolderOpenIcon,  label: "Cases",     href: "/cases"     },
    ],
  },
  {
    title: "Manage",
    items: [
      { icon: UsersIcon,                     label: "Users",    href: "/users",    roles: ["admin", "supervisor"] },
      { icon: DocumentMagnifyingGlassIcon,   label: "Evidence", href: "/evidence" },
    ],
  },
  {
    title: "System",
    items: [
      { icon: ClipboardDocumentListIcon, label: "Audit Log", href: "/audit",    roles: ["admin"] },
      { icon: Cog6ToothIcon,             label: "Settings",  href: "/settings" },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseToken(token: string | null) {
  if (!token) return { name: "User", email: "", role: "analyst" }
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return {
      name:  payload.name  ?? "User",
      email: payload.email ?? "",
      role:  payload.role  ?? "analyst",
    }
  } catch {
    return { name: "User", email: "", role: "analyst" }
  }
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
}

// ─── Sidebar component ────────────────────────────────────────────────────────

export function Sidebar() {
  const path   = window.location.pathname
  const token  = getToken()
  const user   = parseToken(token)

  function isActive(href: string) {
    if (href === "/dashboard") return path === href
    return path === href || path.startsWith(href + "/")
  }

  function canView(item: NavItem) {
    if (!item.roles) return true
    return item.roles.includes(user.role)
  }

  function handleLogout() {
    clearSession()
    window.location.replace("/login")
  }

  return (
    <aside className="w-[220px] min-h-screen bg-[#0d1628] flex flex-col shrink-0 border-r border-white/5">

      {/* ── Logo ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-secondary to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-teal-900/40">
          <ShieldCheckIcon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate">SecureWatch</p>
          <p className="text-white/30 text-[10px] font-medium uppercase tracking-widest leading-tight">Platform</p>
        </div>
      </div>

      {/* ── New Case CTA ───────────────────────────────────────────────────── */}
      <div className="px-3 pt-4 pb-1">
        <a
          href="/cases/new"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl
                     bg-gradient-to-r from-secondary to-teal-500
                     text-white text-sm font-semibold
                     transition-all duration-200
                     hover:brightness-110 hover:shadow-lg hover:shadow-teal-900/40
                     hover:-translate-y-px active:translate-y-0 active:brightness-100"
        >
          <PlusCircleIcon className="w-4 h-4 shrink-0" />
          New Case
        </a>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.title && (
              <p className="text-white/25 text-[9.5px] font-bold uppercase tracking-[0.12em] px-3 pt-4 pb-1.5">
                {section.title}
              </p>
            )}
            {section.items.filter(canView).map(item => {
              const active = isActive(item.href)
              const Icon   = item.icon
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`
                    relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                    text-sm font-medium transition-all duration-150
                    ${active
                      ? "bg-secondary/15 text-secondary"
                      : "text-white/45 hover:text-white/90 hover:bg-white/[0.06]"
                    }
                  `}
                >
                  {/* Active accent bar */}
                  {active && (
                    <span className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full bg-secondary" />
                  )}
                  <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                    active ? "text-secondary" : "text-white/35"
                  }`} />
                  <span className="truncate">{item.label}</span>
                </a>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── User profile ──────────────────────────────────────────────────── */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-secondary/20 border border-secondary/30
                          flex items-center justify-center shrink-0">
            <span className="text-secondary text-xs font-bold leading-none">{initials(user.name)}</span>
          </div>
          {/* Name / role */}
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-xs font-semibold leading-tight truncate">{user.name}</p>
            <p className="text-white/30 text-[10px] leading-tight capitalize">{user.role}</p>
          </div>
          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Log out"
            className="w-7 h-7 flex items-center justify-center rounded-lg
                       text-white/25 hover:text-white/75 hover:bg-white/8
                       transition-all duration-150"
          >
            <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
