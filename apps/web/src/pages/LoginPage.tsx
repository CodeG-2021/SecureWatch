import { EnvelopeIcon, EyeIcon, EyeSlashIcon, LockClosedIcon, ShieldCheckIcon } from "@heroicons/react/24/outline"
import { ArrowRightIcon } from "@heroicons/react/24/solid"
import { useState } from "react"
import { AuthLayout } from "../components/AuthLayout"
import { Button } from "../components/ui/button"
import { Checkbox } from "../components/ui/checkbox"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { loginUser } from "../lib/api"
import { saveSession } from "../lib/session"

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const data = await loginUser({ email, password })
      saveSession(data.token)
      window.location.href = "/dashboard"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout mode="login">
      <div className="space-y-2">
        <h2 className="text-headline-lg text-on-surface">Sign In</h2>
        <p className="text-body-sm text-on-surface-variant">Enter your operational credentials to access the terminal.</p>
      </div>
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-body-sm text-error">
            {error}
          </div>
        )}
        <div>
          <Label htmlFor="email" className="mb-1">
            Operational Email
          </Label>
          <div className="relative">
            <EnvelopeIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="agent@securewatch.gov"
              required
              className="bg-transparent pl-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="password" className="mb-1">
            Passcode
          </Label>
          <div className="relative">
            <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              className="bg-transparent pl-10 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-on-surface"
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center">
            <Checkbox id="remember-me" name="remember-me" />
            <Label htmlFor="remember-me" className="ml-2 cursor-pointer text-body-sm text-on-surface-variant">
              Remember device
            </Label>
          </div>
          <a className="text-label-md text-primary transition-colors hover:text-primary/80" href="#">
            Forgot password?
          </a>
        </div>
        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
          {!loading && <ArrowRightIcon className="h-4 w-4" />}
        </Button>
      </form>
      <div className="mt-8 flex flex-col gap-4 border-t border-outline-variant/30 pt-6">
        <div className="text-center">
          <a className="text-body-sm text-on-surface-variant transition-colors hover:text-primary" href="/register">
            Require operational clearance? <span className="font-semibold underline underline-offset-2">Create an account</span>
          </a>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-outline">
          <ShieldCheckIcon className="h-4 w-4" />
          <span className="text-label-sm">Protected access for authorized users</span>
        </div>
      </div>
    </AuthLayout>
  )
}
