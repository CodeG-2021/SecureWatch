import * as React from "react"
import { cn } from "../../lib/utils"

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function Button({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded border border-transparent bg-primary px-4 py-2.5 text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  )
}
