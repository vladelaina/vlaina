import type { LucideIcon } from 'lucide-react';
import { ICON_MAP_FULL } from './icons';

export function getIconByName(name: string): LucideIcon | null {
  return ICON_MAP_FULL.get(name) || null;
}
