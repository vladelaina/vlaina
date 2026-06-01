import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-[var(--vlaina-opacity-50)] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[var(--vlaina-size-18px)] shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-[var(--ring)] focus-visible:ring-[var(--vlaina-color-accent-soft)] focus-visible:ring-[var(--vlaina-ring-width-3)] aria-invalid:ring-[var(--vlaina-color-status-danger-bg)] aria-invalid:border-[var(--destructive)]",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--vlaina-color-accent-hover)]",
        destructive:
          "bg-[var(--destructive)] text-[var(--vlaina-color-white)] hover:bg-[var(--vlaina-color-danger-hover)] focus-visible:ring-[var(--vlaina-color-status-danger-bg)]",
        outline:
          "border border-[var(--input)] bg-[var(--background)] shadow-[var(--vlaina-shadow-xs)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
        secondary:
          "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--vlaina-bg-hover)]",
        ghost:
          "hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
        link: "text-[var(--primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
