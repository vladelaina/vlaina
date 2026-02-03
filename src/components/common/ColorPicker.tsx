import { cn } from '@/lib/utils';
import { ALL_COLORS, COLOR_HEX, type ItemColor } from '@/lib/colors/index';

interface ColorPickerProps {
  value?: ItemColor | string;
  onChange: (color: ItemColor) => void;
  onHover?: (color: ItemColor | null) => void;
  sizeClass?: string;
  showRing?: boolean;
}

export function ColorPicker({ 
  value, 
  onChange, 
  onHover,
  sizeClass = 'w-5 h-5',
  showRing = true 
}: ColorPickerProps) {
  const currentColor = value || 'default';
  
  const handleMouseLeave = () => {
    onHover?.(null);
  };
  
  return (
    <div className="flex items-center gap-1.5" onMouseLeave={handleMouseLeave}>
      {ALL_COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onChange(color)}
          onMouseEnter={() => onHover?.(color)}
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
        />
      ))}
    </div>
  );
}