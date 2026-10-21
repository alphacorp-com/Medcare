"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

// Shares the opening delay between neighbouring tooltips (moving from one to the next opens
// it at once).
function TooltipProvider({ delay = 300, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} {...props} />
}

// A tooltip on `children` (rendered as the trigger itself, no extra wrapper element).
function Tooltip({
  label,
  children,
  side = "right",
  disabled = false,
  className,
}: {
  label: React.ReactNode
  children: React.ReactElement
  side?: "top" | "right" | "bottom" | "left"
  disabled?: boolean
  className?: string
}) {
  if (disabled) return children
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={8} className="isolate z-50">
          <TooltipPrimitive.Popup
            className={cn(
              "max-w-xs rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/10 origin-(--transform-origin) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0",
              className
            )}
          >
            {label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { Tooltip, TooltipProvider }
