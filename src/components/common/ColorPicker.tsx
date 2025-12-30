/**
 * ColorPicker - 统一的颜色选择器组件
 * 
 * 用于 PanelTaskItem 和 EventEditForm 中的颜色选择
 */

import { cn } from '@/lib/utils';
import { ALL_COLORS, COLOR_HEX, type ItemColor } from '@/lib/colors/index';

interface ColorPickerProps {
  /** 当前选中的颜色 */
  value?: ItemColor | string;
  /** 颜色变更回调 */
  onChange: (color: ItemColor) => void;
  /** 按钮尺寸 class */
  sizeClass?: string;
  /** 是否显示选中状态的 ring */
  showRing?: boolean;
}

export function ColorPicker({ 
  value, 
  onChange, 
  sizeClass = 'w-5 h-5',
  showRing = true 
}: ColorPickerProps) {
  const currentColor = value || 'default';
  
  return (
    <div className="flex items-center gap-1.5">
      {ALL_COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onChange(color)}
          className={cn(
            sizeClass,
            "rounded-sm border-2 transition-all hover:scale-110",
            showRing && (currentColor === color || (!value && color === 'default'))
              ? "ring-2 ring-zinc-400 dark:ring-zinc-500 ring-offset-1 dark:ring-offset-zinc-900"
              : ""
          )}
          style={{
            borderColor: COLOR_HEX[color],
            backgroundColor: color === 'default' ? 'transparent' : undefined,
          }}
          title={color === 'default' ? 'Default' : color}
        />
      ))}
    </div>
  );
}
