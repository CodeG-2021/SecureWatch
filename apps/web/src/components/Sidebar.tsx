import { useEffect, useRef, useState } from "react"
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
  BellIcon,
  CheckIcon,
} from "@heroicons/react/24/outline"
import { clearSession, getToken } from "../lib/session"
import { markAllNotificationsRead, markNotificationRead } from "../lib/api"
import { useNotifications } from "./NotificationContext"

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

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-400",
  medium:   "bg-yellow-400",
  low:      "bg-blue-400",
}

// ─── Sidebar component ────────────────────────────────────────────────────────

export function Sidebar() {
  const path   = window.location.pathname
  const token  = getToken()
  const user   = parseToken(token)

  const { notifications, unreadCount, refresh } = useNotifications()
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!bellOpen) return
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [bellOpen])

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

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
    refresh()
  }

  async function handleNotificationClick(id: string, caseId: string) {
    setBellOpen(false)
    await markNotificationRead(id)
    refresh()
    window.location.href = `/cases/${caseId}`
  }

  const recentNotifications = notifications.slice(0, 10)

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

      {/* ── Bell / Notifications ───────────────────────────────────────────── */}
      <div className="px-3 py-2 border-t border-white/5" ref={bellRef}>
        <button
          onClick={() => setBellOpen(o => !o)}
          className="relative flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg
                     text-white/45 hover:text-white/90 hover:bg-white/[0.06]
                     text-sm font-medium transition-all duration-150"
        >
          <BellIcon className="w-[18px] h-[18px] shrink-0 text-white/35" />
          <span>Alerts</span>
          {unreadCount > 0 && (
            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500
                             flex items-center justify-center text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {bellOpen && (
          <div className="absolute left-[228px] bottom-[90px] w-80 z-50
                          bg-[#111c30] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <p className="text-white text-sm font-semibold">Alerts</p>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-secondary hover:text-white/70 transition-colors"
                >
                  <CheckIcon className="w-3 h-3" />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {recentNotifications.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-6">No alerts yet</p>
              ) : (
                recentNotifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n.id, n.case_id)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0
                                hover:bg-white/[0.04] transition-colors
                                ${!n.read_at ? "bg-white/[0.02]" : ""}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[n.severity] ?? "bg-white/20"}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs leading-snug truncate ${!n.read_at ? "text-white/90 font-medium" : "text-white/50"}`}>
                          {n.title}
                        </p>
                        <p className="text-white/35 text-[10px] mt-0.5 truncate">{n.message}</p>
                        <p className="text-white/20 text-[10px] mt-0.5">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!n.read_at && (
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0 mt-1.5" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

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
