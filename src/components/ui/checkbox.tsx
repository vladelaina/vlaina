import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Icon } from "@/components/ui/icons"

import { cn } from "@/lib/utils"
import { themeMotionTokens, themeStyleResetTokens } from "@/styles/themeTokens"

interface CheckboxProps extends React.ComponentProps<typeof CheckboxPrimitive.Root> {
  checkmarkColor?: string;
}

function Checkbox({
  className,
  checkmarkColor,
  ...props
}: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer border-[var(--input)] bg-[var(--vlaina-color-input-surface)] data-[state=checked]:text-[var(--primary-foreground)] focus-visible:border-[var(--ring)] focus-visible:ring-[var(--vlaina-color-accent-soft)] aria-invalid:ring-[var(--vlaina-color-status-danger-bg)] aria-invalid:border-[var(--destructive)] size-[var(--vlaina-size-18px)] shrink-0 rounded-[var(--vlaina-radius-4px)] border shadow-[var(--vlaina-shadow-xs)] outline-none focus-visible:ring-[var(--vlaina-ring-width-3)] disabled:cursor-not-allowed disabled:opacity-[var(--vlaina-opacity-50)]",
        !checkmarkColor && "data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)]",
        className
      )}
      style={{ transition: themeStyleResetTokens.transitionNone }}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current"
        style={{
          transition: themeStyleResetTokens.transitionNone,
          animation: themeStyleResetTokens.animationNone,
        }}
        forceMount
      >
        <Icon
          name="common.check"
          className="size-[var(--vlaina-size-18px)]"
          style={{
            opacity: props.checked ? themeMotionTokens.opacityVisible : themeMotionTokens.opacityHidden,
            color: checkmarkColor || themeStyleResetTokens.currentColor,
          }}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
