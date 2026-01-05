import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 图标按钮的默认样式：淡色默认，hover 时深色，无背景
export const iconButtonStyles = "text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-secondary)] transition-colors bg-transparent hover:bg-transparent";