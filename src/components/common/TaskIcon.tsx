/**
 * TaskIcon - Unified task/event icon display component
 * 
 * Used for displaying icons in PanelTaskItem and EventEditForm
 * Supports preview state (via global UI store)
 */

import { cn } from '@/lib/utils';
import { getIconByName } from '@/components/Progress/features/IconPicker/utils';
import { useUIStore } from '@/stores/uiSlice';

interface TaskIconProps {
  /** Task/event ID, used to match preview state */
  itemId: string;
  /** Current icon name */
  icon?: string;
  /** Icon color */
  color?: string;
  /** Icon size class */
  sizeClass?: string;
  /** Whether to enable preview (default true) */
  enablePreview?: boolean;
}

export function TaskIcon({ 
  itemId, 
  icon, 
  color, 
  sizeClass = 'size-4',
  enablePreview = true 
}: TaskIconProps) {
  const { previewIconEventId, previewIcon } = useUIStore();
  
  const displayIconName = enablePreview && previewIconEventId === itemId && previewIcon !== null
    ? previewIcon 
    : icon;
  
  if (!displayIconName) return null;
  
  const IconComponent = getIconByName(displayIconName);
  if (!IconComponent) return null;
  
  return (
    <div 
      className="flex-shrink-0"
      style={{ color: color || undefined }}
    >
      <IconComponent 
        className={cn(sizeClass, !color && "text-zinc-400 dark:text-zinc-500")} 
        stroke={1.5} 
      />
    </div>
  );
}
