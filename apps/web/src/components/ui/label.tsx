import * as React from "react"
import { cn } from "../../lib/utils"

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

export function Label({ className, ...props }: LabelProps) {
  return <label className={cn("block text-label-md text-on-surface", className)} {...props} />
}
