import * as React from "react"
import { cn } from "../../lib/utils"

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "block w-full appearance-none rounded border border-outline-variant bg-surface px-3 py-2.5 text-body-sm text-on-surface transition-colors focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
