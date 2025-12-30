import { type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { ICON_MAP_FULL } from './fullIcons';

export function getIconByName(name: string): PhosphorIcon | null {
  return ICON_MAP_FULL.get(name) || null;
}
