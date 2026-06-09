import { ShieldCheckIcon } from "@heroicons/react/24/solid"
import type { ReactNode } from "react"

type AuthLayoutProps = {
  mode: "login" | "register"
  children: ReactNode
}

export function AuthLayout({ mode, children }: AuthLayoutProps) {
  const isRegister = mode === "register"
  const backgroundUrl = isRegister ? "/stitch-assets/register-bg.png" : "/stitch-assets/login-bg.png"

  return (
    <main className="flex min-h-screen bg-background text-on-surface antialiased">
      <section
        className={isRegister ? "relative hidden w-1/2 items-center justify-center overflow-hidden bg-primary lg:flex" : "relative hidden flex-1 flex-col justify-between overflow-hidden bg-primary-container p-12 md:flex"}
        style={{
          backgroundImage: isRegister ? undefined : `url(${backgroundUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundBlendMode: "overlay",
        }}
      >
        {isRegister ? (
          <>
            <img
              src={backgroundUrl}
              alt="Forensic analysis control room"
              className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-overlay"
            />
            <div className="relative z-10 flex max-w-lg flex-col p-12">
              <BrandHeader className="mb-8 text-on-primary" />
              <h2 className="mb-6 font-display text-display leading-tight text-on-primary">
                Precision Analysis.
                <br />
                Absolute Clarity.
              </h2>
              <p className="max-w-md text-body-lg text-on-primary-container">
                Join the command center. Establish your identity to access immutable evidence workflows and advanced forensic telemetry.
              </p>
              <div className="mt-16 flex gap-6 border-t border-primary-container pt-8">
                <Metric label="Status" value="System Nominal" />
                <Metric label="Environment" value="Secure Sandbox" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-primary-container/90 via-primary-container/80 to-primary-container/95" />
            <BrandHeader className="relative z-10 text-on-primary-container" />
            <div className="relative z-10 mt-auto max-w-lg">
              <h2 className="mb-4 font-display text-display leading-tight text-on-primary-container">
                Distributed Digital Evidence Analysis
              </h2>
              <p className="text-body-lg text-on-primary-container/80">Precision intelligence for authorized personnel.</p>
            </div>
            <div className="absolute bottom-0 right-0 h-[600px] w-[600px] translate-x-1/3 translate-y-1/3 rounded-full bg-primary opacity-20 blur-[120px]" />
          </>
        )}
      </section>
      <section className="flex flex-1 items-center justify-center bg-surface-container-lowest px-8 py-10 sm:px-12 lg:px-24">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-2 md:hidden">
            <ShieldCheckIcon className="h-9 w-9 text-primary" />
            <h1 className="text-headline-md text-primary">SecureWatch</h1>
          </div>
          {children}
        </div>
      </section>
    </main>
  )
}

function BrandHeader({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <ShieldCheckIcon className="h-10 w-10" />
      <h1 className="text-headline-lg tracking-tight">SecureWatch</h1>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-label-sm uppercase tracking-wider text-on-primary-container">{label}</p>
      <p className="text-body-md text-secondary-fixed">{value}</p>
    </div>
  )
}
