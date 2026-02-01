import { useMemo } from 'react';
import { getEventInlineStyles } from '@/lib/colors';
import { CALENDAR_CONSTANTS } from '../../../utils/timeUtils';
import type { EventLayoutInfo } from '../../../utils/eventLayout';

const GAP = CALENDAR_CONSTANTS.GAP as number;

interface UseEventStylesProps {
  displayColor: string;
  layout?: EventLayoutInfo;
  isActive: boolean;
  isHovered: boolean;
  isDragging: boolean;
  resizeEdge: 'top' | 'bottom' | null;
}

export function useEventStyles({
  displayColor,
  layout,
  isActive,
  isHovered,
  isDragging,
  resizeEdge,
}: UseEventStylesProps) {
  const colorStyles = getEventInlineStyles(displayColor);
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

  const colors = useMemo(() => ({
    bg: isDark ? colorStyles.bgDark : colorStyles.bg,
    text: isDark ? colorStyles.textDark : colorStyles.text,
    ring: isDark ? colorStyles.ringDark : colorStyles.ring,
    fill: isDark ? colorStyles.fillDark : colorStyles.fill,
    accent: colorStyles.accent,
  }), [colorStyles, isDark]);

  const positioning = useMemo(() => {
    if (!layout) {
      return { left: `${GAP}px`, width: `calc(100% - ${GAP * 2}px)` };
    }

    const { leftPercent, widthPercent, totalColumns, column } = layout;
    const isFirstColumn = column === 0;
    const isLastColumn = column === totalColumns - 1;
    const leftPadding = isFirstColumn ? GAP : GAP / 2;
    const rightPadding = isLastColumn ? GAP : GAP / 2;
    const totalPadding = leftPadding + rightPadding;

    return {
      left: `calc(${leftPercent}% + ${leftPadding}px)`,
      width: `calc(${widthPercent}% - ${totalPadding}px)`,
    };
  }, [layout]);

  const zIndex = useMemo(() => {
    const column = layout?.column || 0;
    const baseZ = column + 10;
    if (isDragging) return 50;
    if (isActive) return 100;
    if (isHovered) return 40;
    return baseZ;
  }, [layout?.column, isActive, isHovered, isDragging]);

  const shadowClass = useMemo(() => {
    if (isDragging) return 'shadow-xl shadow-black/15 dark:shadow-black/40';
    if (isActive) return 'shadow-lg shadow-black/10 dark:shadow-black/30';
    if (isHovered) return 'shadow-md shadow-black/8 dark:shadow-black/25';
    return 'shadow-sm shadow-black/5 dark:shadow-black/15';
  }, [isActive, isHovered, isDragging]);

  const cursorClass = useMemo(() => {
    if (isDragging) return 'cursor-grabbing';
    if (resizeEdge) return 'cursor-row-resize';
    return 'cursor-default';
  }, [resizeEdge, isDragging]);

  return {
    colors,
    positioning,
    zIndex,
    shadowClass,
    cursorClass,
  };
}
