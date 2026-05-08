export const chatComposerPillSurfaceClass = [
  "border border-transparent bg-white dark:bg-white",
  "shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]",
  "hover:shadow-[0_6px_20px_rgba(0,0,0,0.055),inset_0_1px_0_rgba(255,255,255,0.7)]"
].join(" ");

export const chatComposerSurfaceClass = [
  chatComposerPillSurfaceClass,
  "rounded-[26px]",
  "transition-all duration-300 ease-out"
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
  "placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:select-none",
  "focus:outline-none",
  "max-h-[320px] min-h-[24px]"
].join(" ");

export const chatComposerPrimaryButtonClass = [
  "h-9 px-4 rounded-full",
  "bg-black text-white shadow-md",
  "hover:scale-105 active:scale-95",
  "transition-all duration-200",
  "disabled:bg-gray-50 disabled:dark:bg-gray-800",
  "disabled:text-gray-300 disabled:dark:text-gray-600 disabled:cursor-default disabled:shadow-none",
  "disabled:hover:scale-100 disabled:active:scale-100"
].join(" ");

export const chatComposerSecondaryButtonClass = [
  "h-9 px-4 rounded-full",
  "bg-gray-100 dark:bg-zinc-800",
  "text-[var(--vlaina-text-primary)]",
  "hover:bg-gray-200 dark:hover:bg-zinc-700",
  "transition-colors"
].join(" ");
