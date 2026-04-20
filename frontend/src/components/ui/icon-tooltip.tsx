import * as React from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface IconTooltipProps {
  label: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  children: React.ReactElement
}

export function IconTooltip({ label, side = "top", children }: IconTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
