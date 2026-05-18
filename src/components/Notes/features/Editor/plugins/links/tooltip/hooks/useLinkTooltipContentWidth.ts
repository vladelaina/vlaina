import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export const LINK_TOOLTIP_MIN_WIDTH = 280;
export const LINK_TOOLTIP_VIEWPORT_MARGIN = 32;
export const LINK_TOOLTIP_FALLBACK_MAX_WIDTH = 680;

export function useLinkTooltipContentWidth(containerRef: RefObject<HTMLElement | null>) {
    const [contentMaxWidth, setContentMaxWidth] = useState<number | null>(null);

    useEffect(() => {
        const tooltipContainer = containerRef.current?.parentElement;
        const toolbarRoot = tooltipContainer?.closest('[data-note-toolbar-root="true"]');
        const contentRoot = toolbarRoot?.querySelector('[data-note-content-root="true"]');
        if (!(contentRoot instanceof HTMLElement)) {
            return;
        }

        const updateWidth = () => {
            const styles = window.getComputedStyle(contentRoot);
            const paddingLeft = Number.parseFloat(styles.paddingLeft || '0');
            const paddingRight = Number.parseFloat(styles.paddingRight || '0');
            const nextWidth = Math.round(contentRoot.getBoundingClientRect().width - paddingLeft - paddingRight);
            setContentMaxWidth(nextWidth > 0 ? nextWidth : null);
        };

        updateWidth();

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(updateWidth)
            : null;
        resizeObserver?.observe(contentRoot);
        window.addEventListener('resize', updateWidth);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updateWidth);
        };
    }, [containerRef]);

    const viewportMaxWidth = typeof window === 'undefined'
        ? LINK_TOOLTIP_FALLBACK_MAX_WIDTH
        : Math.max(0, window.innerWidth - LINK_TOOLTIP_VIEWPORT_MARGIN);
    const maxWidth = Math.max(
        0,
        Math.min(contentMaxWidth ?? LINK_TOOLTIP_FALLBACK_MAX_WIDTH, viewportMaxWidth)
    );
    const minWidth = Math.min(LINK_TOOLTIP_MIN_WIDTH, maxWidth || LINK_TOOLTIP_MIN_WIDTH);

    return {
        contentMaxWidth,
        maxWidth,
        minWidth,
    };
}
