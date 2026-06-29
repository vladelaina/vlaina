import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { themeCoverLayerTokens, themeMotionTokens, themeStyleResetTokens } from '@/styles/themeTokens';

interface CoverFrozenLayerProps {
  displaySrc: string;
  isVisible: boolean;
  frozenImgRef: React.RefObject<HTMLImageElement | null>;
  frozenImageState: { top: number; left: number; width: number; height: number } | null;
}

export function CoverFrozenLayer({
  displaySrc,
  isVisible,
  frozenImgRef,
  frozenImageState,
}: CoverFrozenLayerProps) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none overflow-hidden transition-none',
        !isVisible ? 'invisible' : 'visible'
      )}
    >
      {displaySrc && (
        <img
          ref={frozenImgRef}
          src={displaySrc}
          alt={t('cover.frozenAlt')}
          style={{
            position: 'absolute',
            top: frozenImageState?.top ?? 0,
            left: frozenImageState?.left ?? 0,
            width: frozenImageState?.width ?? 0,
            height: frozenImageState?.height ?? 0,
            maxWidth: themeStyleResetTokens.maxSizeNone,
            maxHeight: themeStyleResetTokens.maxSizeNone,
            objectFit: themeCoverLayerTokens.objectFitFill,
            opacity: isVisible ? themeMotionTokens.opacityVisible : themeMotionTokens.opacityHidden,
            transition: themeStyleResetTokens.transitionNone,
          }}
        />
      )}
    </div>
  );
}
