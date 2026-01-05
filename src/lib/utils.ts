import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Icon button default styles: subtle color by default, darker on hover, no background
export const iconButtonStyles = "text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-secondary)] transition-colors bg-transparent hover:bg-transparent";

// Notes sidebar color constants
export const NOTES_COLORS = {
  sidebarBg: '#F9F8F7',
  divider: '#EEEEEC',
  dividerHover: '#E0DFDE',
  activeItem: '#F1F0EF',
} as const;