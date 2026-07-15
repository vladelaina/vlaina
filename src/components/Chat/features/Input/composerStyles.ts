import { ghostIconButtonStyles } from '@/lib/utils';

export const chatComposerPillSurfaceClass = [
  "border !border-transparent !bg-[var(--vlaina-color-pill-surface)]",
  "!shadow-[var(--vlaina-shadow-raised-soft)]",
  "hover:!shadow-[var(--vlaina-shadow-menu-hover)]"
].join(" ");

export const chatPopoverPillSurfaceClass = [
  chatComposerPillSurfaceClass,
  "floating-popover-shadow"
].join(" ");

export const chatComposerGhostIconButtonClass = ghostIconButtonStyles;

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
  "placeholder:text-[var(--vlaina-color-brand-pink-muted-text)] placeholder:select-none",
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

export const chatComposerAttachmentTokenSurfaceClass = [
  "bg-[var(--vlaina-sidebar-chat-row-active)]",
  "text-[var(--vlaina-sidebar-row-selected-text)]",
  "shadow-[var(--vlaina-shadow-none)]"
].join(" ");

export const chatComposerFileAttachmentTokenClass = [
  "relative box-border inline-flex items-center gap-1.5 rounded-full",
  chatComposerAttachmentTokenSurfaceClass,
  "py-1 pl-1.5 pr-6 text-[var(--vlaina-font-15)] leading-6 sm:pl-2.5 sm:pr-7"
].join(" ");

export const chatComposerFileAttachmentIconClass =
  "hidden shrink-0 text-[var(--vlaina-sidebar-row-selected-text)] sm:block";

export const chatComposerFileAttachmentLabelClass = "min-w-0 truncate";

export const chatComposerMentionAttachmentTokenClass = [
  "pointer-events-auto group relative inline-flex items-center align-baseline",
  "text-[var(--vlaina-font-15)] leading-6 text-[var(--vlaina-sidebar-row-selected-text)]"
].join(" ");

export const chatComposerMentionAttachmentSurfaceClass = [
  "pointer-events-none absolute -bottom-0.5 left-0 right-0 top-0.5 rounded-full",
  chatComposerAttachmentTokenSurfaceClass
].join(" ");

export const chatComposerAttachmentRemoveButtonBaseClass = [
  "absolute z-[var(--vlaina-z-10)] inline-flex size-4 items-center justify-center rounded-full",
  "bg-[var(--vlaina-sidebar-chat-row-active)] text-[var(--vlaina-font-10)] leading-none text-[var(--vlaina-sidebar-row-selected-text)]",
  "opacity-[var(--vlaina-opacity-0)] shadow-[var(--vlaina-shadow-selection-soft)]",
  "transition-[background-color,opacity]",
  "hover:bg-[var(--vlaina-sidebar-chat-row-hover)]",
  "focus-visible:opacity-[var(--vlaina-opacity-100)] group-hover:opacity-[var(--vlaina-opacity-100)]"
].join(" ");
