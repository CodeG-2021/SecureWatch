import { isAuthenticated } from "./lib/session"
import { LoginPage } from "./pages/LoginPage"
import { RegisterPage } from "./pages/RegisterPage"

const PUBLIC_PATHS = ["/login", "/register"]

export function App() {
  const path = window.location.pathname

  if (path === "/register") {
    return <RegisterPage />
  }

  if (path === "/login" || path === "/") {
    return <LoginPage />
  }

  if (!isAuthenticated() && !PUBLIC_PATHS.includes(path)) {
    window.location.replace("/login")
    return null
  }

  return <LoginPage />
}
