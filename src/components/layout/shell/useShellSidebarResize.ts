import {
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  getDefaultSidebarWidth,
} from '@/lib/layout/sidebarWidth';
import { useResizableDivider } from './useResizableDivider';

const SNAP_THRESHOLD = 20;
const SNAP_RESISTANCE = 0.3;

interface UseShellSidebarResizeProps {
  width: number;
  onWidthChange: (width: number) => void;
}

export function useShellSidebarResize({ width, onWidthChange }: UseShellSidebarResizeProps) {
  return useResizableDivider({
    width,
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    defaultWidth: getDefaultSidebarWidth(),
    onWidthChange,
    direction: 'normal',
    snap: {
      threshold: SNAP_THRESHOLD,
      resistance: SNAP_RESISTANCE,
    },
  });
}
