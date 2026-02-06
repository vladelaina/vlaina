import { useState, useRef, useEffect } from 'react';

const PREVIEW_CLEAR_DELAY = 100;

export function useAssetHover(onHover?: (filename: string | null) => void) {
  const [hoveredFilename, setHoveredFilename] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHoveredRef = useRef<string | null>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const item = target.closest('[data-filename]') as HTMLElement;
      const filename = item?.dataset.filename || null;

      if (filename && filename !== lastHoveredRef.current) {
        if (clearTimeoutRef.current) {
          clearTimeout(clearTimeoutRef.current);
          clearTimeoutRef.current = null;
        }

        lastHoveredRef.current = filename;
        setHoveredFilename(filename);
        onHover?.(filename);
      }
    };

    const handleMouseLeave = () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
      clearTimeoutRef.current = setTimeout(() => {
        lastHoveredRef.current = null;
        setHoveredFilename(null);
        onHover?.(null);
      }, PREVIEW_CLEAR_DELAY);
    };

    grid.addEventListener('mouseover', handleMouseOver);
    grid.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      grid.removeEventListener('mouseover', handleMouseOver);
      grid.removeEventListener('mouseleave', handleMouseLeave);
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, [onHover]);

  return { hoveredFilename, gridRef };
}
