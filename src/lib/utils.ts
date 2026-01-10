import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Icon button default styles: subtle color by default, darker on hover, no background
export const iconButtonStyles = "text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-primary)] transition-colors bg-transparent";

// Notes sidebar color constants
export const NOTES_COLORS = {
  sidebarBg: '#FAFAFA',
  divider: '#E3E2E4',
  dividerHover: '#E0DFDE',
  activeItem: '#F1F0EF',
} as const;