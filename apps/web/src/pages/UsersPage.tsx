import { useEffect, useRef, useState } from "react"
import { AppLayout } from "../components/AppLayout"
import { getToken } from "../lib/session"

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "admin" | "supervisor" | "analyst"
type Status = "active" | "inactive" | "suspended"

interface User {
  id: string
  name: string
  email: string
  role: Role
  status: Status
  created_at: string
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "admin",      label: "Admin",      description: "Full access to all features" },
  { value: "supervisor", label: "Supervisor", description: "Manage analysts and cases" },
  { value: "analyst",    label: "Analyst",    description: "Read and investigate cases" },
]

function roleBadge(role: Role) {
  const styles: Record<Role, string> = {
    admin:      "bg-primary-fixed text-on-primary-fixed border-primary-fixed-dim/20",
    supervisor: "bg-[#fff3e0] text-[#60410c] border-[#edbf7f]/30",
    analyst:    "bg-secondary-container text-on-secondary-container border-secondary/20",
  }
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md font-label-sm text-label-sm border capitalize ${styles[role]}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}

function statusIndicator(status: Status) {
  const dot: Record<Status, string> = {
    active:    "bg-secondary",
    inactive:  "bg-outline-variant",
    suspended: "bg-error",
  }
  const text: Record<Status, string> = {
    active:    "text-on-surface-variant",
    inactive:  "text-outline",
    suspended: "text-error",
  }
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${dot[status]}`} />
      <span className={`font-label-sm text-label-sm capitalize ${text[status]}`}>{status}</span>
    </div>
  )
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  "bg-primary-container text-on-primary-container",
  "bg-surface-variant text-on-surface-variant",
  "bg-[#fff3e0] text-[#60410c]",
  "bg-secondary-container text-on-secondary-container",
]

// ─── Mock data (used while backend endpoint isn't available) ──────────────────

const MOCK_USERS: User[] = [
  { id: "1", name: "Ana García",   email: "ana@securewatch.gov",  role: "admin",      status: "active",   created_at: "2024-01-01" },
  { id: "2", name: "Luis Mora",    email: "luis@securewatch.gov", role: "analyst",    status: "active",   created_at: "2024-02-01" },
  { id: "3", name: "Sara Pérez",   email: "sara@securewatch.gov", role: "supervisor", status: "inactive", created_at: "2024-03-01" },
  { id: "4", name: "Diego Ramírez",email: "diego@securewatch.gov",role: "analyst",    status: "active",   created_at: "2024-04-01" },
]

// ─── API ──────────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"

async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API}/api/v1/users`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error("Failed to fetch users")
  const data = await res.json()
  return data.users
}

async function changeUserRole(userId: string, role: Role): Promise<void> {
  const res = await fetch(`${API}/api/v1/users/${userId}/role`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error?.message ?? "Failed to change role")
  }
}

// ─── 3-dot dropdown ───────────────────────────────────────────────────────────

interface RowMenuProps {
  user: User
  viewerRole: Role
  onChangeRole: (user: User) => void
  onDeactivate: (user: User) => void
}

function RowMenu({ user, viewerRole, onChangeRole, onDeactivate }: RowMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const canEdit = viewerRole === "admin"

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1.5 text-outline hover:text-on-surface rounded-md hover:bg-surface-variant transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <span className="material-symbols-outlined text-[20px]">more_horiz</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-50 py-1 overflow-hidden">
          <button
            className="flex items-center gap-2 w-full px-4 py-2.5 text-body-sm text-on-surface hover:bg-surface-container transition-colors"
            onClick={() => { setOpen(false) }}
          >
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">person</span>
            View profile
          </button>
          <button
            disabled={!canEdit}
            className={`flex items-center gap-2 w-full px-4 py-2.5 text-body-sm transition-colors ${
              canEdit
                ? "text-on-surface hover:bg-surface-container"
                : "text-outline cursor-not-allowed"
            }`}
            onClick={() => { if (canEdit) { setOpen(false); onChangeRole(user) } }}
          >
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">manage_accounts</span>
            Change role
          </button>
          <div className="my-1 border-t border-outline-variant" />
          <button
            disabled={!canEdit}
            className={`flex items-center gap-2 w-full px-4 py-2.5 text-body-sm transition-colors ${
              canEdit
                ? "text-error hover:bg-error/5"
                : "text-outline cursor-not-allowed"
            }`}
            onClick={() => { if (canEdit) { setOpen(false); onDeactivate(user) } }}
          >
            <span className="material-symbols-outlined text-[18px]">block</span>
            Deactivate
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Change Role Modal (2-step) ───────────────────────────────────────────────

interface ChangeRoleModalProps {
  user: User
  onClose: () => void
  onConfirm: (userId: string, newRole: Role) => Promise<void>
}

function ChangeRoleModal({ user, onClose, onConfirm }: ChangeRoleModalProps) {
  const [step, setStep] = useState<"select" | "confirm">("select")
  const [selectedRole, setSelectedRole] = useState<Role>(user.role)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      await onConfirm(user.id, selectedRole)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change role")
      setStep("select")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h3 className="font-semibold text-headline-sm text-on-surface">
            {step === "select" ? "Change Role" : "Confirm Role Change"}
          </h3>
          <button onClick={onClose} className="p-1 text-outline hover:text-on-surface rounded-md transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {step === "select" ? (
            <>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold font-label-md text-label-md ${AVATAR_COLORS[0]}`}>
                  {initials(user.name)}
                </div>
                <div>
                  <p className="font-medium text-body-sm text-on-surface">{user.name}</p>
                  <p className="text-label-sm text-on-surface-variant">Current role: <span className="capitalize">{user.role}</span></p>
                </div>
              </div>

              {error && (
                <p className="text-body-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="space-y-2">
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Select new role</p>
                {ROLES.map(({ value, label, description }) => (
                  <label
                    key={value}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedRole === value
                        ? "border-secondary bg-secondary-container/30"
                        : "border-outline-variant hover:bg-surface-container"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={value}
                      checked={selectedRole === value}
                      onChange={() => setSelectedRole(value)}
                      className="mt-0.5 accent-secondary"
                    />
                    <div>
                      <p className="font-medium text-body-sm text-on-surface">{label}</p>
                      <p className="text-label-sm text-on-surface-variant">{description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 bg-[#fff8e1] border border-[#f0c04080] rounded-xl">
                <span className="material-symbols-outlined text-[#60410c]">warning</span>
                <p className="text-body-sm text-[#60410c]">You are about to change a user's role. This action will be logged in the audit trail.</p>
              </div>

              <div className="bg-surface-container rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold font-label-md text-label-md ${AVATAR_COLORS[0]}`}>
                    {initials(user.name)}
                  </div>
                  <p className="font-medium text-body-sm text-on-surface">{user.name}</p>
                </div>
                <div className="flex items-center gap-3 pl-1">
                  {roleBadge(user.role)}
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">arrow_forward</span>
                  {roleBadge(selectedRole)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant bg-surface-container/30">
          <button
            onClick={step === "confirm" ? () => setStep("select") : onClose}
            className="px-4 py-2 text-label-md text-on-surface-variant border border-outline-variant rounded-lg hover:bg-surface-container transition-colors"
          >
            {step === "confirm" ? "Back" : "Cancel"}
          </button>
          <button
            disabled={loading || selectedRole === user.role}
            onClick={step === "select" ? () => setStep("confirm") : handleConfirm}
            className="px-4 py-2 text-label-md bg-primary text-on-primary rounded-lg hover:bg-surface-tint transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
            {step === "select" ? "Continue" : "Confirm change"}
            {step === "select" && !loading && <span className="material-symbols-outlined text-[16px]">arrow_forward</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleModal, setRoleModal] = useState<User | null>(null)

  // Derive viewer role from JWT
  const viewerRole: Role = (() => {
    try {
      const token = getToken()
      if (!token) return "analyst"
      const claims = JSON.parse(atob(token.split(".")[1]))
      return (claims.role as Role) ?? "analyst"
    } catch { return "analyst" }
  })()

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch(() => setUsers(MOCK_USERS))   // fallback to mock while endpoint is being built
      .finally(() => setLoading(false))
  }, [])

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  async function handleRoleConfirm(userId: string, newRole: Role) {
    await changeUserRole(userId, newRole)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  function handleDeactivate(user: User) {
    // TODO: implement deactivate endpoint
    console.log("Deactivate", user.id)
  }

  return (
    <AppLayout>
      <div className="page-enter p-8 w-full max-w-7xl mx-auto space-y-8">
          {/* Page header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-headline-lg text-on-surface tracking-tight">Users Management</h2>
              <p className="text-body-md text-on-surface-variant mt-1">Manage your team's access and roles</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-md text-body-sm text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors placeholder:text-outline-variant"
                />
              </div>
              {viewerRole === "admin" && (
                <button className="h-10 px-4 bg-primary text-on-primary rounded-md font-label-md text-label-md hover:bg-surface-tint transition-colors flex items-center gap-2 whitespace-nowrap">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add User
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container-low/50">
                    <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider w-1/4">Name</th>
                    <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider w-1/4">Email</th>
                    <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider w-1/6">Role</th>
                    <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider w-1/6">Status</th>
                    <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="py-4 px-6">
                            <div className="h-4 bg-surface-container rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-on-surface-variant text-body-sm">
                        No users found matching "{search}"
                      </td>
                    </tr>
                  ) : (
                    filtered.map((user, idx) => (
                      <tr
                        key={user.id}
                        className={`hover:bg-[#F0FDFA] transition-colors group cursor-default ${user.status === "inactive" ? "opacity-60" : ""}`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-label-md text-label-md ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                              {initials(user.name)}
                            </div>
                            <span className="font-medium text-body-sm text-on-surface">{user.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant">
                          {user.email}
                        </td>
                        <td className="py-4 px-6">{roleBadge(user.role)}</td>
                        <td className="py-4 px-6">{statusIndicator(user.status)}</td>
                        <td className="py-4 px-6 text-right">
                          <RowMenu
                            user={user}
                            viewerRole={viewerRole}
                            onChangeRole={setRoleModal}
                            onDeactivate={handleDeactivate}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
              <span className="text-body-sm text-on-surface-variant">
                Showing {filtered.length} of {users.length} user{users.length !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <button disabled className="p-1 text-outline-variant cursor-not-allowed">
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <button disabled className="p-1 text-outline-variant cursor-not-allowed">
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* Change Role Modal */}
      {roleModal && (
        <ChangeRoleModal
          user={roleModal}
          onClose={() => setRoleModal(null)}
          onConfirm={handleRoleConfirm}
        />
      )}
    </AppLayout>
  )
}
