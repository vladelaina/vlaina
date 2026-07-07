"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useSidebar } from "./sidebarContext"

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  )
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm leading-none outline-hidden ring-[var(--sidebar-ring)] transition-[width,height,padding] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] focus-visible:ring-2 active:bg-[var(--sidebar-accent)] active:text-[var(--sidebar-accent-foreground)] disabled:pointer-events-none disabled:opacity-[var(--vlaina-opacity-50)] group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-[var(--vlaina-opacity-50)] data-[active=true]:bg-[var(--sidebar-accent)] data-[active=true]:font-medium data-[active=true]:text-[var(--sidebar-accent-foreground)] data-[state=open]:hover:bg-[var(--sidebar-accent)] data-[state=open]:hover:text-[var(--sidebar-accent-foreground)] group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>span:last-child]:leading-none [&>svg]:size-[var(--vlaina-size-18px)] [&>svg]:shrink-0 [&>svg]:self-center",
  {
    variants: {
      variant: {
        default: "hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
        outline:
          "bg-[var(--background)] shadow-[var(--vlaina-shadow-sidebar-outline)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] hover:shadow-[var(--vlaina-shadow-sidebar-outline-hover)]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot : "button"
  const { isMobile, state } = useSidebar()

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  )

  if (!tooltip) {
    return button
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltip}
      />
    </Tooltip>
  )
}

export function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  showOnHover?: boolean
}) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        "text-[var(--sidebar-foreground)] ring-[var(--sidebar-ring)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] peer-hover/menu-button:text-[var(--sidebar-accent-foreground)] absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-[var(--vlaina-size-18px)] [&>svg]:shrink-0",
        "after:absolute after:-inset-2 md:after:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "peer-data-[active=true]/menu-button:text-[var(--sidebar-accent-foreground)] group-focus-within/menu-item:opacity-[var(--vlaina-opacity-100)] group-hover/menu-item:opacity-[var(--vlaina-opacity-100)] data-[state=open]:opacity-[var(--vlaina-opacity-100)] md:opacity-[var(--vlaina-opacity-0)]",
        className
      )}
      {...props}
    />
  )
}

export function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "text-[var(--sidebar-foreground)] pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none",
        "peer-hover/menu-button:text-[var(--sidebar-accent-foreground)] peer-data-[active=true]/menu-button:text-[var(--sidebar-accent-foreground)]",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

export function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean
}) {
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-[var(--vlaina-size-18px)] rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-[var(--vlaina-size-18px)] max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

export function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "border-[var(--sidebar-border)] mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

export function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative", className)}
      {...props}
    />
  )
}

export function SidebarMenuSubButton({
  asChild = false,
  size = "md",
  isActive = false,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean
  size?: "sm" | "md"
  isActive?: boolean
}) {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "text-[var(--sidebar-foreground)] ring-[var(--sidebar-ring)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] active:bg-[var(--sidebar-accent)] active:text-[var(--sidebar-accent-foreground)] [&>svg]:text-[var(--sidebar-accent-foreground)] flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 leading-none outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-[var(--vlaina-opacity-50)] aria-disabled:pointer-events-none aria-disabled:opacity-[var(--vlaina-opacity-50)] [&>span:last-child]:truncate [&>span:last-child]:leading-none [&>svg]:size-[var(--vlaina-size-18px)] [&>svg]:shrink-0 [&>svg]:self-center",
        "data-[active=true]:bg-[var(--sidebar-accent)] data-[active=true]:text-[var(--sidebar-accent-foreground)]",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}
