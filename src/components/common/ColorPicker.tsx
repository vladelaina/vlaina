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
            "rounded-sm border-2 transition-all hover:scale-[var(--vlaina-scale-110)]",
            showRing && (currentColor === color || (!value && color === 'default'))
              ? "ring-2 ring-[var(--vlaina-color-control-ring)] app-ring-offset-1 ring-offset-[var(--vlaina-color-control-ring-offset)]"
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
