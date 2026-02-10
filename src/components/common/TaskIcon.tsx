import { AppIcon } from '@/components/common/AppIcon';
import { useUIStore } from '@/stores/uiSlice';
import { getColorHex } from '@/lib/colors';
import { IconSize } from '@/components/ui/icons/sizes';

interface TaskIconProps {
  itemId: string;
  icon?: string;
  color?: string;
  sizeClass?: string;
  size?: number | string | IconSize;
  enablePreview?: boolean;
  fallback?: React.ReactNode;
}

export function TaskIcon({ 
  itemId, 
  icon, 
  color, 
  sizeClass,
  size = 'md',
  enablePreview = true,
  fallback
}: TaskIconProps) {
  const { universalPreviewTarget, universalPreviewIcon, universalPreviewColor, universalPreviewTone } = useUIStore();
  
  const isPreviewing = enablePreview && universalPreviewTarget === itemId;
  
  let displayIcon = isPreviewing && universalPreviewIcon ? universalPreviewIcon : icon;
  const displayColor = isPreviewing && universalPreviewColor ? universalPreviewColor : color;
  
  if (!displayIcon) {
      return fallback || null;
  }

  // Force icon color to match task color if it's a vector icon
  if (displayIcon.startsWith('icon:') && displayColor) {
      const parts = displayIcon.split(':');
      if (parts.length >= 2) {
          const colorHex = getColorHex(displayColor);
          displayIcon = `icon:${parts[1]}:${colorHex}`;
      }
  }

  // Convert sizeClass to roughly pixel size if needed, or pass className
  // UniversalIcon uses style={{width: size, height: size}} if size provided.
  // If only className provided, it works via CSS.
  
  return (
    <AppIcon
        icon={displayIcon}
        className={sizeClass}
        size={size} // if undefined, relies on className
        
        // Use the explicit color prop for forced overrides (e.g. priority color)
        color={displayColor}
        
        // Pass preview overrides directly (UniversalIcon handles the priority logic usually, 
        // but here we already resolved `displayIcon`. 
        // However, UniversalIcon's internal Emoji renderer needs the tone.)
        previewColor={isPreviewing ? universalPreviewColor : null}
        previewTone={isPreviewing ? universalPreviewTone : null}
    />
  );
}