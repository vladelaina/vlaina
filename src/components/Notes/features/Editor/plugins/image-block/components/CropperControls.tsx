import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { PremiumSlider } from '@/components/ui/premium-slider';

interface CropperControlsProps {
    zoom: number;
    setZoom: (value: number) => void;
    minZoom: number;
    maxZoom: number;
    isActive: boolean;
    isSaving: boolean;
    onSave: (e: React.MouseEvent) => void;
    onCancel: (e: React.MouseEvent) => void;
}

export const CropperControls = ({
    zoom,
    setZoom,
    minZoom,
    maxZoom,
    isActive,
    isSaving,
    onSave,
    onCancel
}: CropperControlsProps) => {
    return (
        <div
            className={cn(
                "absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-3 py-1.5 bg-white dark:bg-[#1e1e1e] border border-black/5 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-[60]",
                "transition-all duration-200 origin-bottom",
                isActive ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
            )}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            draggable={false}
        >
            <div
                className="w-32 flex items-center"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <span className="text-[10px] font-bold text-[var(--neko-text-tertiary)] mr-2 uppercase tracking-wide">Zoom</span>
                <PremiumSlider
                    min={minZoom}
                    max={maxZoom}
                    step={0.1}
                    value={zoom}
                    onChange={setZoom}
                    className="w-full"
                />
            </div>
            <div className="h-[18px] w-px bg-gray-200 dark:bg-zinc-700" />
            <div className="flex items-center gap-1">
                <button
                    onClick={onCancel}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-400 transition-colors"
                    title="Cancel"
                    aria-label="Cancel crop"
                >
                    <Icon name="common.close" size="md" />
                </button>
                <button
                    onClick={onSave}
                    disabled={isSaving}
                    className="p-1 rounded-lg bg-[var(--neko-accent)] hover:bg-[var(--neko-accent-hover)] text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    title="Save"
                    aria-label="Save crop"
                >
                    <Icon name="common.check" size="md" />
                </button>
            </div>
        </div>
    );
};
