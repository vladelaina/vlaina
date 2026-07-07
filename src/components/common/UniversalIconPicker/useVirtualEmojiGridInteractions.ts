import { useEffect, useRef, type RefObject } from 'react';

export function useVirtualEmojiGridInteractions(
  parentRef: RefObject<HTMLDivElement | null>,
  onSelect: (emoji: string) => void,
  onPreview?: (emoji: string | null) => void,
): void {
  const lastPreviewRef = useRef<string | null>(null);
  const onPreviewRef = useRef(onPreview);
  const onSelectRef = useRef(onSelect);
  onPreviewRef.current = onPreview;
  onSelectRef.current = onSelect;

  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-icon]') as HTMLElement;
      const icon = button?.dataset.icon || null;
      if (icon !== lastPreviewRef.current) {
        lastPreviewRef.current = icon;
        onPreviewRef.current?.(icon);
      }
    };

    const handleMouseLeave = () => {
      if (lastPreviewRef.current !== null) {
        lastPreviewRef.current = null;
        onPreviewRef.current?.(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-icon]') as HTMLElement;
      if (button?.dataset.icon) {
        onSelectRef.current(button.dataset.icon);
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleClick);
    };
  }, [parentRef]);
}
