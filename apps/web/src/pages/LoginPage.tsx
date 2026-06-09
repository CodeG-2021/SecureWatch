import { EnvelopeIcon, EyeIcon, LockClosedIcon, ShieldCheckIcon } from "@heroicons/react/24/outline"
import { ArrowRightIcon } from "@heroicons/react/24/solid"
import { AuthLayout } from "../components/AuthLayout"
import { Button } from "../components/ui/button"
import { Checkbox } from "../components/ui/checkbox"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"

export function LoginPage() {
  return (
    <AuthLayout mode="login">
      <div className="space-y-2">
        <h2 className="text-headline-lg text-on-surface">Sign In</h2>
        <p className="text-body-sm text-on-surface-variant">Enter your operational credentials to access the terminal.</p>
      </div>
      <form className="space-y-6">
        <div>
          <Label htmlFor="email" className="mb-1">
            Operational Email
          </Label>
          <div className="relative">
            <EnvelopeIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="agent@securewatch.gov" required className="bg-transparent pl-10" />
          </div>
        </div>
        <div>
          <Label htmlFor="password" className="mb-1">
            Passcode
          </Label>
          <div className="relative">
            <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
            <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required className="bg-transparent pl-10 pr-10" />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-on-surface" type="button">
              <EyeIcon className="h-5 w-5" />
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
        <Button className="w-full" type="submit">
          Sign in
          <ArrowRightIcon className="h-4 w-4" />
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
