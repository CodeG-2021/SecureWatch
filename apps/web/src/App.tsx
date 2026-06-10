import { isAuthenticated } from "./lib/session"
import { CaseDetailPage }  from "./pages/CaseDetailPage"
import { CasesPage }       from "./pages/CasesPage"
import { CreateCasePage }  from "./pages/CreateCasePage"
import { DashboardPage }   from "./pages/DashboardPage"
import { LoginPage }       from "./pages/LoginPage"
import { RegisterPage }    from "./pages/RegisterPage"
import { UsersPage }       from "./pages/UsersPage"

function requireAuth(page: React.ReactNode): React.ReactNode {
  if (!isAuthenticated()) {
    window.location.replace("/login")
    return null
  }
  return page
}

export function App() {
  const path = window.location.pathname

  // ── Public routes ─────────────────────────────────────────────────────────
  if (path === "/register") {
    return <RegisterPage />
  }

  if (path === "/login" || path === "/") {
    if (isAuthenticated()) {
      window.location.replace("/dashboard")
      return null
    }
    return <LoginPage />
  }

  // ── Protected routes ──────────────────────────────────────────────────────
  if (path === "/dashboard") {
    return requireAuth(<DashboardPage />) as React.ReactElement
  }

  if (path === "/users") {
    return requireAuth(<UsersPage />) as React.ReactElement
  }

  if (path === "/cases") {
    return requireAuth(<CasesPage />) as React.ReactElement
  }

  if (path === "/cases/new") {
    return requireAuth(<CreateCasePage />) as React.ReactElement
  }

  if (/^\/cases\/[^/]+$/.test(path)) {
    return requireAuth(<CaseDetailPage />) as React.ReactElement
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  window.location.replace("/login")
  return null
}
