export const chatComposerPillSurfaceClass = [
  "border !border-transparent !bg-[var(--vlaina-color-pill-surface)]",
  "!shadow-[var(--vlaina-shadow-raised-soft)]",
  "hover:!shadow-[var(--vlaina-shadow-menu-hover)]"
].join(" ");

export const chatPopoverPillSurfaceClass = [
  chatComposerPillSurfaceClass,
  "floating-popover-shadow"
].join(" ");

export const chatComposerGhostIconButtonClass = [
  "rounded-full bg-transparent shadow-none",
  "transition-[background-color,color,box-shadow,transform] duration-[var(--vlaina-duration-200)]",
  "hover:bg-[var(--vlaina-color-pill-surface-hover)] hover:shadow-[var(--vlaina-shadow-menu-hover)] hover:text-[var(--vlaina-accent)]"
].join(" ");

export const chatComposerSurfaceClass = [
  chatComposerPillSurfaceClass,
  "rounded-[var(--vlaina-radius-26px)]",
  "transition-shadow duration-[var(--vlaina-duration-300)] ease-out"
].join(" ");

export const chatComposerFrameClass = [
  "flex flex-col justify-between min-h-[var(--vlaina-size-84px)] pt-3"
].join(" ");

export const chatComposerInputBlockClass = [
  "relative px-4 pt-4 pb-2"
].join(" ");

export const chatComposerTextareaClass = [
  "w-full resize-none bg-transparent",
  "select-none focus:select-text",
  "text-[var(--vlaina-font-15)] leading-6 text-[var(--vlaina-text-primary)]",
  "placeholder:text-[var(--vlaina-color-brand-pink)] placeholder:select-none",
  "focus:outline-none",
  "max-h-[var(--vlaina-size-320px)] min-h-[var(--vlaina-size-24px)]"
].join(" ");

export const chatComposerPrimaryButtonClass = [
  "h-9 px-4 rounded-full",
  "bg-[var(--vlaina-color-inverse-surface)] text-[var(--vlaina-color-inverse-text)] shadow-[var(--vlaina-shadow-md)]",
  "hover:scale-[var(--vlaina-scale-105)] active:scale-[var(--vlaina-scale-95)]",
  "transition-[background-color,color,box-shadow,opacity,transform] duration-[var(--vlaina-duration-200)]",
  "disabled:bg-[var(--vlaina-bg-secondary)]",
  "disabled:text-[var(--vlaina-color-text-disabled)] disabled:cursor-default disabled:shadow-[var(--vlaina-shadow-none)]",
  "disabled:hover:scale-[var(--vlaina-scale-100)] disabled:active:scale-[var(--vlaina-scale-100)]"
].join(" ");

export const chatComposerSecondaryButtonClass = [
  "h-9 px-4 rounded-full",
  "bg-[var(--vlaina-bg-tertiary)]",
  "text-[var(--vlaina-text-primary)]",
  "hover:bg-[var(--vlaina-hover-filled)]",
  "transition-colors"
].join(" ");
