import { useUIStore } from '@/stores/uiSlice';
import { ALL_COLORS, COLOR_HEX, RAINBOW_GRADIENT } from '@/lib/colors';
import { cn } from '@/lib/utils';

export function ColorFilter() {
    const { selectedColors, toggleColor, toggleAllColors } = useUIStore();

    return (
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-wide">Filters</div>
            <div className="flex items-center gap-2 flex-wrap">
                {/* Color options - in new order */}
                {ALL_COLORS.map(color => {
                    const colorHex = color === 'default' ? '#a1a1aa' : COLOR_HEX[color];
                    const isSelected = selectedColors.includes(color);

                    return (
                        <button
                            key={color}
                            onClick={() => toggleColor(color)}
                            className={cn(
                                "w-[18px] h-[18px] rounded-full border-2 transition-all duration-200 hover:scale-110",
                                isSelected
                                    ? "border-transparent shadow-sm scale-110"
                                    : "bg-transparent border-current hover:bg-current/10"
                            )}
                            style={{
                                color: colorHex, // Sets 'currentColor' for border and hover bg
                                backgroundColor: isSelected ? colorHex : undefined // Overrides for solid active state
                            }}
                            title={color}
                        />
                    );
                })}
                {/* Select all button */}
                <button
                    onClick={() => toggleAllColors()}
                    className={`w-[18px] h-[18px] rounded-full transition-all hover:scale-110 relative overflow-hidden ml-auto ${selectedColors.length === ALL_COLORS.length
                        ? 'ring-1 ring-zinc-400 dark:ring-zinc-500 ring-offset-1 dark:ring-offset-zinc-900 shadow-sm'
                        : 'opacity-70 hover:opacity-100'
                        }`}
                    style={{ background: RAINBOW_GRADIENT }}
                    title="Toggle All"
                />
            </div>
        </div>
    );
}