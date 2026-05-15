import type { EditorView } from '@milkdown/kit/prose/view';
import { openExternalHref } from '@/lib/navigation/externalLinks';

function resolveTooltipEligibleLink(target: HTMLElement | null): HTMLElement | null {
    if (!target) return null;

    const tocLink = target.closest('.toc-link[data-heading-pos]');
    if (tocLink instanceof HTMLElement) return null;

    const link = target.closest('.autolink') || target.closest('a[href]');
    return link instanceof HTMLElement ? link : null;
}

type LinkTooltipEventHandlers = {
    view: EditorView;
    dom: HTMLElement;
    showLinkWithDelay: (link: HTMLElement, shouldValidateCursor?: boolean) => void;
    hide: (force?: boolean) => void;
    scheduleFocus: () => void;
    reposition: () => void;
    clearHideTimer: () => void;
    startHideTimer: () => void;
    clearShowTimer: () => void;
    setKeyboardInteraction: (value: boolean) => void;
    hasActiveLink: () => boolean;
};

export function installLinkTooltipEvents(handlers: LinkTooltipEventHandlers): () => void {
    const {
        view,
        dom,
        showLinkWithDelay,
        hide,
        scheduleFocus,
        reposition,
        clearHideTimer,
        startHideTimer,
        clearShowTimer,
        setKeyboardInteraction,
        hasActiveLink,
    } = handlers;

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || dom.classList.contains('hidden')) return;
        event.preventDefault();
        event.stopPropagation();
        hide(true);
        scheduleFocus();
    };

    const handleScroll = () => {
        if (dom.hasAttribute('data-editing')) {
            reposition();
            return;
        }
        if (hasActiveLink()) hide();
    };

    const handleEditorMouseDown = async (event: MouseEvent) => {
        const link = resolveTooltipEligibleLink(event.target as HTMLElement);
        if (!link) {
            setKeyboardInteraction(false);
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const href = link.getAttribute('href') || link.getAttribute('data-href');
        if (href) await openExternalHref(href);
    };

    const handleEditorMouseOver = (event: Event) => {
        const link = resolveTooltipEligibleLink(event.target as HTMLElement);
        if (!link) return;

        clearHideTimer();
        showLinkWithDelay(link, false);
    };

    const handleEditorMouseOut = (event: Event) => {
        const link = resolveTooltipEligibleLink(event.target as HTMLElement);
        if (!link) return;

        clearShowTimer();
        startHideTimer();
    };

    const handleTooltipMouseLeave = (event: MouseEvent) => {
        if (dom.hasAttribute('data-dropdown-open')) return;

        const relatedTarget = event.relatedTarget as HTMLElement | null;
        if (relatedTarget) {
            const isRadixDropdown = relatedTarget.closest('[data-radix-popper-content-wrapper]') ||
                relatedTarget.closest('[role="menu"]');
            if (isRadixDropdown) return;
        }

        startHideTimer();
    };

    const handleEditorKeyDown = (event: KeyboardEvent): void => {
        setKeyboardInteraction(true);

        if (event.key === 'Tab' && !dom.classList.contains('hidden')) {
            event.preventDefault();
            const firstFocusable = dom.querySelector('button, input') as HTMLElement;
            firstFocusable?.focus();
        }
    };

    view.dom.addEventListener('mouseover', handleEditorMouseOver);
    view.dom.addEventListener('mouseout', handleEditorMouseOut);
    view.dom.addEventListener('mousedown', handleEditorMouseDown, true);
    dom.addEventListener('mouseenter', clearHideTimer);
    dom.addEventListener('mouseleave', handleTooltipMouseLeave);
    window.addEventListener('scroll', handleScroll, true);
    view.dom.addEventListener('keydown', handleEditorKeyDown, true);
    document.addEventListener('keydown', handleGlobalKeyDown, true);

    return () => {
        view.dom.removeEventListener('mouseover', handleEditorMouseOver);
        view.dom.removeEventListener('mouseout', handleEditorMouseOut);
        view.dom.removeEventListener('mousedown', handleEditorMouseDown, true);
        dom.removeEventListener('mouseenter', clearHideTimer);
        dom.removeEventListener('mouseleave', handleTooltipMouseLeave);
        window.removeEventListener('scroll', handleScroll, true);
        view.dom.removeEventListener('keydown', handleEditorKeyDown, true);
        document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
}
