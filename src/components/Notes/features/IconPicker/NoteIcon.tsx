/**
 * NoteIcon - Renders either an emoji or a custom icon
 */

import { FileText } from 'lucide-react';
import { ICON_LIST } from './icons';

const ICON_MAP = Object.fromEntries(
  ICON_LIST.map(item => [item.name, item.icon])
) as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>;

interface NoteIconProps {
  icon: string;
  size?: number;
  className?: string;
}

export function NoteIcon({ icon, size = 16, className }: NoteIconProps) {
  if (icon.startsWith('icon:')) {
    const parts = icon.split(':');
    const iconName = parts[1];
    const color = parts[2] || '#6b7280';
    const IconComponent = ICON_MAP[iconName] || FileText;
    
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          lineHeight: 1,
        }}
      >
        <IconComponent size={size} style={{ color }} />
      </span>
    );
  }
  
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
