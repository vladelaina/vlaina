import { cn } from '@/lib/utils';
import { hexToRgba } from '@/lib/colors';

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
        className={cn('absolute inset-[-10%] scale-[1.04]', radiusClassName)}
        style={{
          background: `
            radial-gradient(circle at 50% 50%, transparent 44%, ${hexToRgba(color, 0.12)} 72%, ${hexToRgba(color, 0.2)} 100%),
            linear-gradient(180deg, ${hexToRgba(color, 0.18)} 0%, transparent 28%, transparent 72%, ${hexToRgba(color, 0.2)} 100%),
            linear-gradient(90deg, ${hexToRgba(color, 0.16)} 0%, transparent 24%, transparent 76%, ${hexToRgba(color, 0.18)} 100%)
          `,
          filter: 'blur(10px)',
          opacity: 0.95,
        }}
      />
      <span
        className={cn('absolute inset-0', radiusClassName)}
        style={{
          boxShadow: `
            inset 0 0 0 1px ${hexToRgba(color, 0.16)},
            inset 0 0 26px ${hexToRgba(color, 0.22)}
          `,
          background: `
            linear-gradient(180deg, ${hexToRgba(color, 0.16)} 0%, transparent 24%, transparent 76%, ${hexToRgba(color, 0.18)} 100%),
            linear-gradient(90deg, ${hexToRgba(color, 0.14)} 0%, transparent 22%, transparent 78%, ${hexToRgba(color, 0.16)} 100%)
          `,
        }}
      />
    </span>
  );
}
