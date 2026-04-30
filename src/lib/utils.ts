import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const iconButtonStyles = "cursor-pointer text-[var(--vlaina-text-tertiary)] hover:text-[var(--vlaina-text-primary)] transition-colors bg-transparent disabled:cursor-default";
