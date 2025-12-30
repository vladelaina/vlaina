/**
 * TaskIcon - 统一的任务/事件图标显示组件
 * 
 * 用于 PanelTaskItem 和 EventEditForm 中显示图标
 * 支持预览状态（通过全局 UI store）
 */

import { cn } from '@/lib/utils';
import { getIconByName } from '@/components/Progress/features/IconPicker/utils';
import { useUIStore } from '@/stores/uiSlice';

interface TaskIconProps {
  /** 任务/事件 ID，用于匹配预览状态 */
  itemId: string;
  /** 当前图标名称 */
  icon?: string;
  /** 图标颜色 */
  color?: string;
  /** 图标尺寸 class */
  sizeClass?: string;
  /** 是否启用预览（默认 true） */
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
  
  // 如果启用预览且当前项正在被预览，使用预览图标
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
        weight="duotone" 
      />
    </div>
  );
}
