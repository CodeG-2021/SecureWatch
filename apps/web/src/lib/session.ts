const SESSION_KEY = "sw_token"

export function saveSession(token: string) {
  localStorage.setItem(SESSION_KEY, token)
}

export function getToken(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function isAuthenticated(): boolean {
  const token = getToken()
  if (!token) return false

  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}
