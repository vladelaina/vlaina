import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const iconButtonStyles = "cursor-pointer text-[var(--vlaina-text-tertiary)] hover:text-[var(--vlaina-text-primary)] transition-colors bg-transparent disabled:cursor-default";

export const ghostIconButtonStyles = [
  "rounded-full bg-transparent shadow-none",
  "transition-[background-color,color,box-shadow,transform] duration-[var(--vlaina-duration-200)]",
  "hover:bg-[var(--vlaina-color-pill-surface-hover)] hover:shadow-[var(--vlaina-shadow-menu-hover)] hover:text-[var(--vlaina-accent)]",
].join(" ");
