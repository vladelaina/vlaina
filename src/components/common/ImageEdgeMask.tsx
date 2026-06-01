import { cn } from '@/lib/utils';
import { hexToRgba } from '@/lib/colors';
import { themeImageEdgeMaskTokens } from '@/styles/themeTokens';

interface ImageEdgeMaskProps {
  color: string;
  rounding?: string;
  className?: string;
}

export function ImageEdgeMask({ color, rounding, className }: ImageEdgeMaskProps) {
  const radiusClassName = rounding || 'rounded-sm';

  return (
    <span className={cn('pointer-events-none absolute inset-0', radiusClassName, className)}>
      <span
        className={cn('absolute inset-[var(--vlaina-inset-edge-mask)] scale-[var(--vlaina-scale-104)]', radiusClassName)}
        style={{
          background: `
            radial-gradient(circle at 50% 50%, transparent ${themeImageEdgeMaskTokens.outerRadialInnerStop}, ${hexToRgba(color, themeImageEdgeMaskTokens.outerRadialMidAlpha)} ${themeImageEdgeMaskTokens.outerRadialMidStop}, ${hexToRgba(color, themeImageEdgeMaskTokens.outerRadialEndAlpha)} 100%),
            linear-gradient(180deg, ${hexToRgba(color, themeImageEdgeMaskTokens.outerVerticalStartAlpha)} 0%, transparent ${themeImageEdgeMaskTokens.outerVerticalInnerStart}, transparent ${themeImageEdgeMaskTokens.outerVerticalInnerEnd}, ${hexToRgba(color, themeImageEdgeMaskTokens.outerVerticalEndAlpha)} 100%),
            linear-gradient(90deg, ${hexToRgba(color, themeImageEdgeMaskTokens.outerHorizontalStartAlpha)} 0%, transparent ${themeImageEdgeMaskTokens.outerHorizontalInnerStart}, transparent ${themeImageEdgeMaskTokens.outerHorizontalInnerEnd}, ${hexToRgba(color, themeImageEdgeMaskTokens.outerHorizontalEndAlpha)} 100%)
          `,
          filter: `blur(${themeImageEdgeMaskTokens.outerBlur})`,
          opacity: themeImageEdgeMaskTokens.outerOpacity,
        }}
      />
      <span
        className={cn('absolute inset-0', radiusClassName)}
        style={{
          boxShadow: `
            inset 0 0 0 ${themeImageEdgeMaskTokens.innerBorderWidth} ${hexToRgba(color, themeImageEdgeMaskTokens.innerBorderAlpha)},
            inset 0 0 ${themeImageEdgeMaskTokens.innerGlowSize} ${hexToRgba(color, themeImageEdgeMaskTokens.innerGlowAlpha)}
          `,
          background: `
            linear-gradient(180deg, ${hexToRgba(color, themeImageEdgeMaskTokens.innerVerticalStartAlpha)} 0%, transparent ${themeImageEdgeMaskTokens.innerVerticalInnerStart}, transparent ${themeImageEdgeMaskTokens.innerVerticalInnerEnd}, ${hexToRgba(color, themeImageEdgeMaskTokens.innerVerticalEndAlpha)} 100%),
            linear-gradient(90deg, ${hexToRgba(color, themeImageEdgeMaskTokens.innerHorizontalStartAlpha)} 0%, transparent ${themeImageEdgeMaskTokens.innerHorizontalInnerStart}, transparent ${themeImageEdgeMaskTokens.innerHorizontalInnerEnd}, ${hexToRgba(color, themeImageEdgeMaskTokens.innerHorizontalEndAlpha)} 100%)
          `,
        }}
      />
    </span>
  );
}
