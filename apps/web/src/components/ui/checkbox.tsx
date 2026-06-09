import * as React from "react"
import { cn } from "../../lib/utils"

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn("h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary", className)}
      {...props}
    />
  )
}
