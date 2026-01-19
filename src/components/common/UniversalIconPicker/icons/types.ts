import * as LucideIcons from 'lucide-react';
import { COLOR_HEX } from '@/lib/colors/index';

export interface IconItem {
  name: string;
  icon: any;
  color: string;
}

export interface IconCategory {
  id: string;
  name: string;
  emoji: string | React.ComponentType<{ size?: number; className?: string }>;
  icons: IconItem[];
}

export const DEFAULT_ICON_COLOR = COLOR_HEX.amber;

// Helper: create IconItem array from icon names, filter out non-existent icons and duplicates
export function createIconItems(iconNames: string[]): IconItem[] {
  const seen = new Set<string>();
  return iconNames
    .map(name => {
      const icon = (LucideIcons as any)[name];
      if (!icon) return null;
      const lowerName = name.toLowerCase();
      if (seen.has(lowerName)) return null;
      seen.add(lowerName);
      return {
        name: lowerName,
        icon,
        color: DEFAULT_ICON_COLOR,
      };
    })
    .filter((item): item is IconItem => item !== null);
}

// Get icon component by name
export function getIcon(name: string) {
  return (LucideIcons as any)[name];
}
