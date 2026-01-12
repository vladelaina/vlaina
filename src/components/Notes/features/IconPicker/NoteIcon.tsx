/**
 * NoteIcon - Renders either an emoji or a custom icon
 * Performance optimized: uses memo and shallow comparison
 */

import { memo, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { useUIStore } from '@/stores/uiSlice';
import { ICON_MAP as ICON_ITEM_MAP, EMOJI_MAP } from './constants';

interface NoteIconProps {
  icon: string;
  size?: number;
  className?: string;
}

// Icon 渲染组件
const IconIconRenderer = memo(function IconIconRenderer({ 
  iconName,
  originalColor,
  size, 
  className,
  previewColor,
}: {
  iconName: string;
  originalColor: string;
  size?: number;
  className?: string;
  previewColor: string | null;
}) {
  const color = previewColor || originalColor;
  const iconItem = ICON_ITEM_MAP.get(iconName);
  const IconComponent = iconItem?.icon || FileText;
  
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
});

// Emoji 渲染组件
const EmojiIconRenderer = memo(function EmojiIconRenderer({ 
  emoji,
  size, 
  className,
  previewTone,
}: {
  emoji: string;
  size?: number;
  className?: string;
  previewTone: number | null;
}) {
  const displayEmoji = useMemo(() => {
    if (previewTone === null) return emoji;
    const item = EMOJI_MAP.get(emoji);
    if (item && item.skins && item.skins.length > previewTone) {
      return previewTone === 0 ? item.native : (item.skins[previewTone]?.native || item.native);
    }
    return emoji;
  }, [emoji, previewTone]);
  
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

  if (icon.startsWith('icon:')) {
    const parts = icon.split(':');
    const iconName = parts[1];
    const originalColor = parts[2] || '#6b7280';
    
    return (
      <IconIconRenderer 
        iconName={iconName}
        originalColor={originalColor}
        size={size} 
        className={className}
        previewColor={previewIconColor}
      />
    );
  }

  return (
    <EmojiIconRenderer 
      emoji={icon}
      size={size} 
      className={className}
      previewTone={previewSkinTone}
    />
  );
}
