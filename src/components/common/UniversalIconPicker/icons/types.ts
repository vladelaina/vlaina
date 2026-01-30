import * as MdIcons from 'react-icons/md';
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
      // Try to find icon by name (e.g. "MdStar") or construct it ("Star" -> "MdStar")
      const iconName = name.startsWith('Md') ? name : `Md${name}`;
      const icon = (MdIcons as any)[iconName];
      
      if (!icon) return null;
      
      const lowerName = name.toLowerCase();
      if (seen.has(lowerName)) return null;
      seen.add(lowerName);
      return {
        name: name, // Keep original name for display
        icon,
        color: DEFAULT_ICON_COLOR,
      };
    })
    .filter((item): item is IconItem => item !== null);
}

// Get icon component by name
export function getIcon(name: string) {
  const iconName = name.startsWith('Md') ? name : `Md${name}`;
  return (MdIcons as any)[iconName];
}
