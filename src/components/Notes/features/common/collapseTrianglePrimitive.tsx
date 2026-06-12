import type { HTMLAttributes, SVGAttributes } from 'react';
import { cn } from '@/lib/utils';
import { COLLAPSE_TRIANGLE_PATH, COLLAPSE_TRIANGLE_VIEW_BOX } from './collapseTriangle';
import { themeIconTokens, themeStyleResetTokens } from '@/styles/themeTokens';

type CollapseTriangleVisibility = 'always' | 'hover' | 'hover-unless-collapsed';

export const COLLAPSE_TRIANGLE_SIDEBAR_COLOR_CLASS = 'text-[color:var(--vlaina-collapse-triangle-sidebar-fg)]';
export const COLLAPSE_TRIANGLE_SIDEBAR_SOFT_COLOR_CLASS = 'text-[color:var(--vlaina-collapse-triangle-sidebar-soft-fg)]';
export const COLLAPSE_TRIANGLE_ACTIVE_COLOR_CLASS = 'text-[color:var(--vlaina-collapse-triangle-active-fg)]';
export const COLLAPSE_TRIANGLE_SIDEBAR_ROW_HOVER_COLOR_CLASS = 'group-hover/sidebar-row:text-[color:var(--vlaina-collapse-triangle-hover-fg)] group-focus-within/sidebar-row:text-[color:var(--vlaina-collapse-triangle-hover-fg)] hover:text-[color:var(--vlaina-collapse-triangle-hover-fg)]';
export const COLLAPSE_TRIANGLE_GROUP_HOVER_COLOR_CLASS = 'group-hover:text-[color:var(--vlaina-collapse-triangle-hover-fg)] group-focus-within:text-[color:var(--vlaina-collapse-triangle-hover-fg)]';

export function getSidebarCollapseTriangleColorClassName({
  active = false,
  soft = false,
  rowHover = false,
  groupHover = false,
}: {
  active?: boolean;
  soft?: boolean;
  rowHover?: boolean;
  groupHover?: boolean;
} = {}) {
  return cn(
    active
      ? COLLAPSE_TRIANGLE_ACTIVE_COLOR_CLASS
      : soft
        ? COLLAPSE_TRIANGLE_SIDEBAR_SOFT_COLOR_CLASS
        : COLLAPSE_TRIANGLE_SIDEBAR_COLOR_CLASS,
    rowHover && COLLAPSE_TRIANGLE_SIDEBAR_ROW_HOVER_COLOR_CLASS,
    groupHover && COLLAPSE_TRIANGLE_GROUP_HOVER_COLOR_CLASS,
  );
}

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
  if (visibility === 'always') return 'opacity-[var(--vlaina-opacity-100)]';
  if (visibility === 'hover') {
    return 'opacity-[var(--vlaina-opacity-0)] group-hover:opacity-[var(--vlaina-opacity-100)] group-focus-within:opacity-[var(--vlaina-opacity-100)]';
  }
  return collapsed
    ? 'opacity-[var(--vlaina-opacity-100)]'
    : 'opacity-[var(--vlaina-opacity-0)] group-hover:opacity-[var(--vlaina-opacity-100)] group-focus-within:opacity-[var(--vlaina-opacity-100)]';
}

export function CollapseTriangleIcon({
  collapsed = false,
  size = themeIconTokens.sizeCollapseTriangle,
  className,
  style,
  ...props
}: CollapseTriangleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={COLLAPSE_TRIANGLE_VIEW_BOX}
      fill={themeStyleResetTokens.fillNone}
      stroke={themeStyleResetTokens.currentColor}
      strokeWidth={themeIconTokens.strokeCollapseTriangle}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(collapsed && '-rotate-90', className)}
      style={style}
      focusable="false"
      {...props}
    >
      <path d={COLLAPSE_TRIANGLE_PATH} />
    </svg>
  );
}

export function CollapseTriangleAffordance({
  collapsed,
  size = themeIconTokens.sizeCollapseTriangle,
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
      style={style}
      {...props}
    >
      <CollapseTriangleIcon collapsed={collapsed} size={size} className={iconClassName} />
    </span>
  );
}
