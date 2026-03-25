import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const iconButtonStyles = "cursor-pointer text-[var(--vlaina-text-tertiary)] hover:text-[var(--vlaina-text-primary)] transition-colors bg-transparent disabled:cursor-default";

export const NOTES_COLORS = {
  sidebarBg: '#FFFFFF',
  divider: '#EFF3F4',
  dividerHover: '#DDE6E8',
  activeItem: '#F1F0EF',
} as const;
