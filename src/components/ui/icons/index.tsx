import { ComponentProps, forwardRef } from 'react';
import { icons, IconName } from './registry';
import { ICON_SIZES, IconSize } from './sizes';
import { cn } from '@/lib/utils';

export { type IconName };

interface IconProps extends Omit<ComponentProps<'svg'>, 'ref'> {
  name: IconName;
  size?: number | string | IconSize;
  className?: string;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ name, size = '1em', className, style, ...props }, ref) => {
    const IconComponent = icons[name];

    if (!IconComponent) {
      console.warn(`Icon "${name}" not found in registry.`);
      return null;
    }

    const resolvedSize = (typeof size === 'string' && size in ICON_SIZES)
      ? ICON_SIZES[size as IconSize]
      : size;

    return (
      <IconComponent
        ref={ref}
        className={cn('inline-block shrink-0', className)}
        style={{ 
          width: resolvedSize, 
          height: resolvedSize, 
          fontSize: typeof resolvedSize === 'number' ? `${resolvedSize}px` : resolvedSize,
          ...style 
        }}
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';
