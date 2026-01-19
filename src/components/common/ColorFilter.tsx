import { useUIStore } from '@/stores/uiSlice';
import { ALL_COLORS, COLOR_HEX, RAINBOW_GRADIENT } from '@/lib/colors';

export function ColorFilter() {
    const { selectedColors, toggleColor, toggleAllColors } = useUIStore();

    return (
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-wide">Filters</div>
            <div className="flex items-center gap-2 flex-wrap">
                {/* Color options - in new order */}
                {ALL_COLORS.map(color => (
                    <button
                        key={color}
                        onClick={() => toggleColor(color)}
                        className={`w-3.5 h-3.5 rounded-full border transition-all hover:scale-110 ${selectedColors.includes(color)
                            ? 'ring-1 ring-zinc-400 dark:ring-zinc-500 ring-offset-1 dark:ring-offset-zinc-900 border-transparent shadow-sm'
                            : 'border-transparent opacity-70 hover:opacity-100'
                            }`}
                        style={{
                            backgroundColor: color === 'default' ? '#a1a1aa' : COLOR_HEX[color] // distinct grey for default
                        }}
                        title={color}
                    />
                ))}
                {/* Select all button */}
                <button
                    onClick={() => toggleAllColors()}
                    className={`w-4 h-4 rounded-full transition-all hover:scale-110 relative overflow-hidden ml-auto ${selectedColors.length === ALL_COLORS.length
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
