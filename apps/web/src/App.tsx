import { isAuthenticated } from "./lib/session"
import { AuditPage }       from "./pages/AuditPage"
import { CaseDetailPage }  from "./pages/CaseDetailPage"
import { CasesPage }       from "./pages/CasesPage"
import { CreateCasePage }  from "./pages/CreateCasePage"
import { DashboardPage }   from "./pages/DashboardPage"
import { LoginPage }       from "./pages/LoginPage"
import { RegisterPage }    from "./pages/RegisterPage"
import { UsersPage }       from "./pages/UsersPage"
import { NotificationProvider } from "./components/NotificationContext"

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
  let page: React.ReactNode = null

  if (path === "/dashboard") {
    page = requireAuth(<DashboardPage />)
  } else if (path === "/audit") {
    page = requireAuth(<AuditPage />)
  } else if (path === "/users") {
    page = requireAuth(<UsersPage />)
  } else if (path === "/cases") {
    page = requireAuth(<CasesPage />)
  } else if (path === "/cases/new") {
    page = requireAuth(<CreateCasePage />)
  } else if (/^\/cases\/[^/]+$/.test(path)) {
    page = requireAuth(<CaseDetailPage />)
  } else {
    window.location.replace("/login")
    return null
  }

  if (!page) return null
  return <NotificationProvider>{page as React.ReactElement}</NotificationProvider>
}
