import type { HTMLAttributes, SVGAttributes } from 'react';
import { cn } from '@/lib/utils';
import { COLLAPSE_TRIANGLE_PATH, COLLAPSE_TRIANGLE_VIEW_BOX } from './collapseTriangle';

type CollapseTriangleVisibility = 'always' | 'hover' | 'hover-unless-collapsed';

interface CollapseTriangleIconProps extends SVGAttributes<SVGSVGElement> {
  collapsed?: boolean;
  size?: number;
}

interface CollapseTriangleAffordanceProps extends HTMLAttributes<HTMLSpanElement> {
  collapsed: boolean;
  size?: number;
  visibility?: CollapseTriangleVisibility;
  iconClassName?: string;
}

function getVisibilityClassName(
  visibility: CollapseTriangleVisibility,
  collapsed: boolean
): string {
  if (visibility === 'always') return 'opacity-100';
  if (visibility === 'hover') {
    return 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100';
  }
  return collapsed
    ? 'opacity-100'
    : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100';
}

export function CollapseTriangleIcon({
  collapsed = false,
  size = 16,
  className,
  style,
  ...props
}: CollapseTriangleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={COLLAPSE_TRIANGLE_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(collapsed && '-rotate-90', className)}
      style={{ transition: 'transform 0.15s ease', ...style }}
      focusable="false"
      {...props}
    >
      <path d={COLLAPSE_TRIANGLE_PATH} />
    </svg>
  );
}

export function CollapseTriangleAffordance({
  collapsed,
  size = 16,
  visibility = 'always',
  className,
  iconClassName,
  style,
  ...props
}: CollapseTriangleAffordanceProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm',
        getVisibilityClassName(visibility, collapsed),
        className
      )}
      style={{ transition: 'opacity 0.15s, color 0.15s', ...style }}
      {...props}
    >
      <CollapseTriangleIcon collapsed={collapsed} size={size} className={iconClassName} />
    </span>
  );
}
