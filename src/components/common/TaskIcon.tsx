/**
 * TaskIcon - Unified task/event icon display component
 * 
 * Used for displaying icons in PanelTaskItem and EventEditForm
 * Supports preview state (via global UI store)
 */

import { AppIcon } from '@/components/common/AppIcon';
import { useUIStore } from '@/stores/uiSlice';

interface TaskIconProps {
  /** Task/event ID, used to match preview state */
  itemId: string;
  /** Current icon name */
  icon?: string;
  /** Icon color (legacy override, mostly for category colors) */
  color?: string;
  /** Icon size class or pixel value */
  sizeClass?: string; // tailwind class like "size-4"
  /** Icon size in pixels (if provided, overrides sizeClass somewhat) */
  size?: number;
  /** Whether to enable preview (default true) */
  enablePreview?: boolean;
}

export function TaskIcon({ 
  itemId, 
  icon, 
  color, 
  sizeClass = 'size-4',
  size,
  enablePreview = true 
}: TaskIconProps) {
  const { universalPreviewTarget, universalPreviewIcon, universalPreviewColor, universalPreviewTone } = useUIStore();
  
  const isPreviewing = enablePreview && universalPreviewTarget === itemId;
  
  const displayIcon = isPreviewing && universalPreviewIcon ? universalPreviewIcon : icon;
  const displayColor = isPreviewing && universalPreviewColor ? universalPreviewColor : color;
  const displayTone = isPreviewing ? universalPreviewTone : undefined;
  
  if (!displayIcon) return null;

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