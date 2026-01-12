/**
 * NoteIcon - Renders either an emoji or a custom icon
 * Performance optimized: uses memo and shallow comparison
 */

import { memo } from 'react';
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

// 内部渲染组件，不订阅 store
const IconRenderer = memo(function IconRenderer({ 
  icon, 
  size, 
  className,
  previewColor,
  previewTone,
}: NoteIconProps & { previewColor: string | null; previewTone: number | null }) {
  if (icon.startsWith('icon:')) {
    const parts = icon.split(':');
    const iconName = parts[1];
    const originalColor = parts[2] || '#6b7280';
    const color = previewColor || originalColor;
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
  if (previewTone !== null) {
    const item = EMOJI_MAP.get(icon);
    if (item && item.skins && item.skins.length > previewTone) {
      displayEmoji = previewTone === 0 ? item.native : (item.skins[previewTone]?.native || item.native);
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
});

// 外层组件订阅 store，只在预览状态变化时重渲染
export function NoteIcon({ icon, size = 16, className }: NoteIconProps) {
  const previewIconColor = useUIStore(s => s.notesPreviewIconColor);
  const previewSkinTone = useUIStore(s => s.notesPreviewSkinTone);

  return (
    <IconRenderer 
      icon={icon} 
      size={size} 
      className={className}
      previewColor={previewIconColor}
      previewTone={previewSkinTone}
    />
  );
}
