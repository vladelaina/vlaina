export const chatComposerPillSurfaceClass = [
  "border !border-transparent !bg-[var(--vlaina-color-white)]",
  "!shadow-[var(--vlaina-shadow-raised-soft)]",
  "hover:!shadow-[var(--vlaina-shadow-menu-hover)]"
].join(" ");

export const chatPopoverPillSurfaceClass = [
  chatComposerPillSurfaceClass,
  "vlaina-floating-popover-shadow"
].join(" ");

export const chatComposerSurfaceClass = [
  chatComposerPillSurfaceClass,
  "rounded-[26px]",
  "transition-shadow duration-300 ease-out"
].join(" ");

export const chatComposerFrameClass = [
  "flex flex-col justify-between min-h-[84px] pt-3"
].join(" ");

export const chatComposerInputBlockClass = [
  "relative px-4 pt-4 pb-2"
].join(" ");

export const chatComposerTextareaClass = [
  "w-full resize-none bg-transparent",
  "select-none focus:select-text",
  "text-[15px] leading-6 text-[var(--vlaina-text-primary)]",
  "placeholder:text-[var(--vlaina-color-text-soft)] placeholder:select-none",
  "focus:outline-none",
  "max-h-[320px] min-h-[24px]"
].join(" ");

export const chatComposerPrimaryButtonClass = [
  "h-9 px-4 rounded-full",
  "bg-[var(--vlaina-color-inverse-surface)] text-[var(--vlaina-color-inverse-text)] shadow-md",
  "hover:scale-105 active:scale-95",
  "transition-[background-color,color,box-shadow,opacity,transform] duration-200",
  "disabled:bg-[var(--vlaina-bg-secondary)]",
  "disabled:text-[var(--vlaina-color-text-disabled)] disabled:cursor-default disabled:shadow-none",
  "disabled:hover:scale-100 disabled:active:scale-100"
].join(" ");

export const chatComposerSecondaryButtonClass = [
  "h-9 px-4 rounded-full",
  "bg-[var(--vlaina-bg-tertiary)]",
  "text-[var(--vlaina-text-primary)]",
  "hover:bg-[var(--vlaina-hover-filled)]",
  "transition-colors"
].join(" ");
