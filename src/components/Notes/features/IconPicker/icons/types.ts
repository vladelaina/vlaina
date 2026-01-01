// Icon 类型定义
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
