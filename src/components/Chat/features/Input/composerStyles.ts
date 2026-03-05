export const chatComposerSurfaceClass = [
  "bg-white dark:bg-[#18181b]",
  "border border-black/5 dark:border-white/10",
  "rounded-[26px]",
  "shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]",
  "transition-all duration-300 ease-out",
  "hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
  "focus-within:ring-1 focus-within:ring-black/5 dark:focus-within:ring-white/10"
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
  "text-[15px] leading-6 text-[var(--neko-text-primary)]",
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
  "text-[var(--neko-text-primary)]",
  "hover:bg-gray-200 dark:hover:bg-zinc-700",
  "transition-colors"
].join(" ");
