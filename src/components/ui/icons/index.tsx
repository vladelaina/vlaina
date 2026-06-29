import { ComponentProps, forwardRef } from 'react';
import { icons, IconName } from './registry';
import { ICON_SIZES, IconSize } from './sizes';
import { cn } from '@/lib/utils';
import { themeIconTokens } from '@/styles/themeTokens';

export { type IconName };

interface IconProps extends Omit<ComponentProps<'svg'>, 'ref'> {
  name: IconName;
  size?: number | string | IconSize;
  className?: string;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ name, size = themeIconTokens.defaultCssSize, className, style, ...props }, ref) => {
    const IconComponent = icons[name];

    if (!IconComponent) {
      return null;
    }

    const resolvedSize = (typeof size === 'string' && size in ICON_SIZES)
      ? ICON_SIZES[size as IconSize]
      : size;
    const isDecorative = props['aria-label'] == null && props['aria-labelledby'] == null;

    return (
      <IconComponent
        ref={ref}
        aria-hidden={props['aria-hidden'] ?? (isDecorative ? true : undefined)}
        focusable={props.focusable ?? false}
        role={props.role ?? (isDecorative ? undefined : 'img')}
        className={cn('inline-block shrink-0 align-middle', className)}
        style={{ 
          width: resolvedSize, 
          height: resolvedSize, 
          fontSize: typeof resolvedSize === 'number' ? `${resolvedSize}px` : resolvedSize,
          lineHeight: 1,
          ...style 
        }}
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';
