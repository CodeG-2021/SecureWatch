import { EnvelopeIcon, IdentificationIcon, LockClosedIcon, UserIcon } from "@heroicons/react/24/outline"
import { UserPlusIcon } from "@heroicons/react/24/solid"
import { FormEvent, ReactElement, useState } from "react"
import { AuthLayout } from "../components/AuthLayout"
import { Button } from "../components/ui/button"
import { Checkbox } from "../components/ui/checkbox"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Select } from "../components/ui/select"
import { registerUser } from "../lib/api"

export function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSuccess("")

    const formData = new FormData(event.currentTarget)
    const password = String(formData.get("password") ?? "")
    const confirmPassword = String(formData.get("confirm-password") ?? "")

    if (password !== confirmPassword) {
      setError("Passwords must match.")
      return
    }

    setIsSubmitting(true)
    try {
      await registerUser({
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        role: String(formData.get("role") ?? ""),
        password,
      })
      setSuccess("Account created. You can now sign in once login is enabled.")
      event.currentTarget.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout mode="register">
      <div>
        <h2 className="mb-2 text-headline-lg text-on-surface">Create an account</h2>
        <p className="text-body-md text-on-surface-variant">Enter your details to register as a new operative.</p>
      </div>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <Field id="name" label="Full Name" icon={<UserIcon />} placeholder="Jane Doe" autoComplete="name" />
        <Field id="email" label="Organizational Email" icon={<EnvelopeIcon />} placeholder="analyst@domain.com" type="email" autoComplete="email" />
        <div>
          <Label htmlFor="role" className="mb-1">
            Access Role
          </Label>
          <div className="relative">
            <IdentificationIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
            <Select id="role" name="role" required defaultValue="" className="pl-10">
              <option disabled value="">
                Select your clearance level
              </option>
              <option value="analyst">Analyst</option>
              <option value="supervisor">Supervisor</option>
              <option value="administrator">Administrator</option>
            </Select>
          </div>
        </div>
        <Field id="password" label="Password" icon={<LockClosedIcon />} placeholder="••••••••" type="password" autoComplete="new-password" />
        <div>
          <Field id="confirm-password" label="Confirm Password" icon={<LockClosedIcon />} placeholder="••••••••" type="password" autoComplete="new-password" />
          <p className="mt-2 text-label-sm text-on-surface-variant">Min 8 characters, include a symbol.</p>
        </div>
        <div className="flex items-start">
          <Checkbox id="terms" name="terms" required className="mt-0.5" />
          <Label htmlFor="terms" className="ml-3 text-body-sm text-on-surface">
            I agree to the{" "}
            <a className="font-medium text-primary underline decoration-outline-variant underline-offset-2 transition-colors hover:text-secondary hover:decoration-secondary" href="#">
              Terms of Service
            </a>{" "}
            and{" "}
            <a className="font-medium text-primary underline decoration-outline-variant underline-offset-2 transition-colors hover:text-secondary hover:decoration-secondary" href="#">
              Security Policy
            </a>
          </Label>
        </div>
        {error && <p className="rounded bg-error-container px-3 py-2 text-body-sm text-on-error-container">{error}</p>}
        {success && <p className="rounded bg-secondary-container px-3 py-2 text-body-sm text-on-secondary-container">{success}</p>}
        <Button className="w-full py-3" type="submit" disabled={isSubmitting}>
          <UserPlusIcon className="h-4 w-4" />
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <div className="text-center">
        <p className="text-body-sm text-on-surface-variant">
          Already have an account?{" "}
          <a className="font-medium text-primary transition-colors hover:text-secondary" href="/">
            Sign in
          </a>
        </p>
      </div>
    </AuthLayout>
  )
}

type FieldProps = {
  id: string
  label: string
  icon: ReactElement
  placeholder: string
  type?: string
  autoComplete?: string
}

function Field({ id, label, icon, placeholder, type = "text", autoComplete }: FieldProps) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1">
        {label}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline">{icon}</span>
        <Input id={id} name={id} type={type} autoComplete={autoComplete} placeholder={placeholder} required className="pl-10" />
      </div>
    </div>
  )
}
