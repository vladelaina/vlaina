import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      spellCheck={false}
      className={cn(
        "file:text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] selection:bg-[var(--vlaina-selection-bg)] selection:text-[var(--vlaina-color-white)] border-[var(--input)] h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-[var(--vlaina-shadow-xs)] transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-[var(--vlaina-opacity-50)] md:text-sm",
        "focus-visible:border-[var(--ring)] focus-visible:ring-[var(--vlaina-color-accent-soft)] focus-visible:ring-[var(--vlaina-ring-width-3)]",
        "aria-invalid:ring-[var(--vlaina-color-status-danger-bg)] aria-invalid:border-[var(--destructive)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
