import * as React from "react"
import { cn } from "../../lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "block w-full rounded border border-outline-variant bg-surface px-3 py-2.5 text-body-sm text-on-surface placeholder:text-outline transition-colors focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
    {...props}
  />
))
Input.displayName = "Input"
