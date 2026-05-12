import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

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
    const { t } = useI18n();

    return (
        <div
            className={cn(
                "absolute bottom-4 left-1/2 -translate-x-1/2 floating-toolbar-inner image-cropper-toolbar !rounded-[26px] z-[60]",
                chatComposerPillSurfaceClass,
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
                <PremiumSlider
                    min={minZoom}
                    max={maxZoom}
                    step={0.1}
                    value={zoom}
                    onChange={setZoom}
                    className="w-full"
                />
            </div>
            <div className="toolbar-divider" />
            <div className="flex items-center gap-1">
                <button
                    onClick={onCancel}
                    className="toolbar-btn image-toolbar-btn"
                    title={t('common.cancel')}
                    aria-label={t('common.cancel')}
                >
                    <Icon name="common.close" size="md" />
                </button>
                <button
                    onClick={onSave}
                    disabled={isSaving}
                    className="toolbar-btn image-toolbar-btn active disabled:opacity-50 disabled:cursor-default"
                    title={t('common.saveChanges')}
                    aria-label={t('common.saveChanges')}
                >
                    <Icon name="common.check" size="md" />
                </button>
            </div>
        </div>
    );
};
