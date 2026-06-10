const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"

export type RegisterPayload = {
  name: string
  email: string
  password: string
  role: string
}

export async function registerUser(payload: RegisterPayload) {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = data?.error?.message ?? "Registration failed."
    throw new Error(message)
  }

  return data
}

export type LoginPayload = {
  email: string
  password: string
}

export async function loginUser(payload: LoginPayload) {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = data?.error?.message ?? "Login failed."
    throw new Error(message)
  }

  return data as { token: string; user: { id: string; name: string; email: string; role: string } }
}
