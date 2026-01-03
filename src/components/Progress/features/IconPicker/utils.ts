import type { Icon as TablerIcon } from '@tabler/icons-react';
import { ICON_MAP_FULL } from './icons';

export function getIconByName(name: string): TablerIcon | null {
  return ICON_MAP_FULL.get(name) || null;
}
