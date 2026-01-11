import * as LucideIcons from 'lucide-react';

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

export const DEFAULT_ICON_COLOR = '#f59e0b';

// Helper: create IconItem array from icon names, filter out non-existent icons
export function createIconItems(iconNames: string[]): IconItem[] {
  return iconNames
    .map(name => {
      const icon = (LucideIcons as any)[name];
      if (!icon) return null;
      return {
        name: name.toLowerCase(),
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
