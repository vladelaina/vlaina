import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Icon } from "@/components/ui/icons"
import { BlurBackdrop, type BlurBackdropProps } from "@/components/common/BlurBackdrop"

import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[var(--vlaina-z-50)] bg-[var(--vlaina-color-overlay)] duration-[var(--vlaina-duration-75)]",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  containerClassName,
  children,
  showCloseButton = true,
  useBlurBackdrop = false,
  blurBackdropProps,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  useBlurBackdrop?: boolean
  containerClassName?: string
  blurBackdropProps?: Partial<Pick<BlurBackdropProps, "className" | "overlayClassName" | "zIndex" | "blurPx" | "duration">>
}) {
  const { t } = useI18n()

  return (
    <DialogPortal data-slot="dialog-portal">
      {useBlurBackdrop ? (
        <DialogPrimitive.Overlay asChild>
          <BlurBackdrop
            className={cn("z-[var(--vlaina-z-50)]", blurBackdropProps?.className)}
            overlayClassName={blurBackdropProps?.overlayClassName}
            zIndex={blurBackdropProps?.zIndex ?? 50}
            blurPx={blurBackdropProps?.blurPx}
            duration={blurBackdropProps?.duration}
          />
        </DialogPrimitive.Overlay>
      ) : (
        <DialogOverlay />
      )}
      <div className={cn("fixed inset-0 z-[var(--vlaina-z-50)] flex items-center justify-center p-4", containerClassName)}>
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            "bg-[var(--background)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 relative grid w-full max-w-[var(--vlaina-width-dialog-default)] gap-4 rounded-lg border border-[var(--border)] p-6 shadow-[var(--vlaina-shadow-lg)] duration-[var(--vlaina-duration-75)] sm:max-w-lg",
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className="ring-offset-[var(--background)] focus:ring-[var(--ring)] data-[state=open]:bg-[var(--accent)] data-[state=open]:text-[var(--muted-foreground)] absolute top-4 right-4 rounded-xs opacity-[var(--vlaina-opacity-70)] transition-opacity hover:opacity-[var(--vlaina-opacity-100)] focus:ring-2 app-focus-ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[var(--vlaina-size-18px)]"
            >
              <Icon name="common.close" />
              <span className="sr-only">{t('common.close')}</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-[var(--vlaina-font-20)] leading-none font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-[var(--muted-foreground)] text-[var(--vlaina-font-13)]", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
