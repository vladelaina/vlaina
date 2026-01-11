/**
 * NoteIcon - Renders either an emoji or a custom icon
 */

import { FileText } from 'lucide-react';
import { useUIStore } from '@/stores/uiSlice';
import { ICON_LIST } from './icons';
import { EMOJI_MAP } from './constants';

const ICON_MAP = Object.fromEntries(
  ICON_LIST.map(item => [item.name, item.icon])
) as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>;

interface NoteIconProps {
  icon: string;
  size?: number;
  className?: string;
}

export function NoteIcon({ icon, size = 16, className }: NoteIconProps) {
  const previewIconColor = useUIStore(s => s.notesPreviewIconColor);
  const previewSkinTone = useUIStore(s => s.notesPreviewSkinTone);

  if (icon.startsWith('icon:')) {
    const parts = icon.split(':');
    const iconName = parts[1];
    const originalColor = parts[2] || '#6b7280';
    // 如果有预览颜色，使用预览颜色
    const color = previewIconColor || originalColor;
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
  
  // Emoji - 支持肤色预览
  let displayEmoji = icon;
  if (previewSkinTone !== null) {
    const item = EMOJI_MAP.get(icon);
    if (item && item.skins && item.skins.length > previewSkinTone) {
      displayEmoji = previewSkinTone === 0 ? item.native : (item.skins[previewSkinTone]?.native || item.native);
    }
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
      {displayEmoji}
    </span>
  );
}
