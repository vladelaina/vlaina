import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"
import { themeUiFeedbackTokens } from "@/styles/themeTokens"

function TooltipProvider({
  delayDuration = themeUiFeedbackTokens.defaultTooltipDelayMs,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      disableHoverableContent={true}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  showArrow = true,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & { showArrow?: boolean }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-[var(--foreground)] text-[var(--background)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[var(--vlaina-z-max)] w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance pointer-events-none duration-[var(--vlaina-duration-75)]",
          className
        )}
        {...props}
      >
        {children}
        {showArrow && (
          <TooltipPrimitive.Arrow className="bg-[var(--foreground)] fill-[var(--foreground)] z-[var(--vlaina-z-max)] size-2.5 translate-y-[var(--vlaina-translate-tooltip-arrow-y)] rotate-45 rounded-[var(--vlaina-radius-2px)]" />
        )}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
