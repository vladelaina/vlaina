/**
 * NoteIcon - Renders either an emoji or a custom icon
 * 
 * Supports both emoji strings and icon:name:color format
 * Reuses ICON_LIST from IconPicker to avoid duplicate definitions
 */

import { IconFileText } from '@tabler/icons-react';
import { ICON_LIST } from './IconPicker';

// 从 ICON_LIST 构建图标映射
const ICON_MAP = Object.fromEntries(
  ICON_LIST.map(item => [item.name, item.icon])
) as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>;

interface NoteIconProps {
  icon: string;
  size?: number;
  className?: string;
}

export function NoteIcon({ icon, size = 16, className }: NoteIconProps) {
  // 检查是否是自定义图标格式: icon:name:color
  if (icon.startsWith('icon:')) {
    const parts = icon.split(':');
    const iconName = parts[1];
    const color = parts[2] || '#6b7280';
    
    const IconComponent = ICON_MAP[iconName];
    if (IconComponent) {
      return <IconComponent size={size} style={{ color }} />;
    }
    // 如果找不到图标，返回默认文件图标
    return <IconFileText size={size} style={{ color: '#6b7280' }} />;
  }
  
  // 否则是 emoji
  return (
    <span 
      className={className}
      style={{ 
        fontSize: size,
        lineHeight: 1,
        display: 'inline-block',
        userSelect: 'none',
      }}
    >
      {icon}
    </span>
  );
}
