import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { floatingToolbarKey } from '../../floating-toolbar/floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '../../floating-toolbar/types';
import { openEditorLinkHref } from '../utils/openEditorLinkHref';

const MOUSE_CLICK_SUPPRESSION_MS = 500;

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

function collapseEditorSelectionAtPointer(view: EditorView, event: MouseEvent): void {
    const { selection } = view.state;
    if (selection.empty) {
        return;
    }

    const coordsPos = view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
    })?.pos;
    const maxPos = view.state.doc.content.size;
    const tr = view.state.tr;
    const doc = tr.doc ?? view.state.doc;
    const cursorPositions = Array.from(new Set(
        [coordsPos, selection.to]
            .filter((pos): pos is number => typeof pos === 'number')
            .map((pos) => Math.max(0, Math.min(pos, maxPos)))
    ));

    let didSetSelection = false;
    for (const cursorPos of cursorPositions) {
        try {
            tr.setSelection(TextSelection.create(doc, cursorPos));
            didSetSelection = true;
            break;
        } catch {
        }
    }

    if (!didSetSelection) {
        const fallbackPos = Math.max(0, Math.min(selection.to, maxPos));
        tr.setSelection(Selection.near(doc.resolve(fallbackPos), -1));
    }

    view.dom.ownerDocument.defaultView?.getSelection()?.removeAllRanges();
    view.dispatch(
        tr
            .setMeta(floatingToolbarKey, { type: TOOLBAR_ACTIONS.HIDE })
            .setMeta('addToHistory', false)
    );
    view.focus();
}

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
    let mouseOpenedLink: HTMLElement | null = null;
    let clearMouseOpenedLinkTimer: number | null = null;

    const trackMouseOpenedLink = (link: HTMLElement) => {
        mouseOpenedLink = link;
        if (clearMouseOpenedLinkTimer !== null) {
            window.clearTimeout(clearMouseOpenedLinkTimer);
        }
        clearMouseOpenedLinkTimer = window.setTimeout(() => {
            mouseOpenedLink = null;
            clearMouseOpenedLinkTimer = null;
        }, MOUSE_CLICK_SUPPRESSION_MS);
    };

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
            if (!dom.classList.contains('hidden')) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                hide(true);
                collapseEditorSelectionAtPointer(view, event);
            }
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const href = link.getAttribute('href') || link.getAttribute('data-href');
        if (href) {
            trackMouseOpenedLink(link);
            await openEditorLinkHref(href, { view });
        }
    };

    const handleEditorClick = async (event: MouseEvent) => {
        const link = resolveTooltipEligibleLink(event.target as HTMLElement);
        if (!link) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (link === mouseOpenedLink) {
            mouseOpenedLink = null;
            if (clearMouseOpenedLinkTimer !== null) {
                window.clearTimeout(clearMouseOpenedLinkTimer);
                clearMouseOpenedLinkTimer = null;
            }
            return;
        }

        const href = link.getAttribute('href') || link.getAttribute('data-href');
        if (href) await openEditorLinkHref(href, { view });
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
    view.dom.addEventListener('click', handleEditorClick, true);
    dom.addEventListener('mouseenter', clearHideTimer);
    dom.addEventListener('mouseleave', handleTooltipMouseLeave);
    window.addEventListener('scroll', handleScroll, true);
    view.dom.addEventListener('keydown', handleEditorKeyDown, true);
    document.addEventListener('keydown', handleGlobalKeyDown, true);

    return () => {
        if (clearMouseOpenedLinkTimer !== null) {
            window.clearTimeout(clearMouseOpenedLinkTimer);
        }
        view.dom.removeEventListener('mouseover', handleEditorMouseOver);
        view.dom.removeEventListener('mouseout', handleEditorMouseOut);
        view.dom.removeEventListener('mousedown', handleEditorMouseDown, true);
        view.dom.removeEventListener('click', handleEditorClick, true);
        dom.removeEventListener('mouseenter', clearHideTimer);
        dom.removeEventListener('mouseleave', handleTooltipMouseLeave);
        window.removeEventListener('scroll', handleScroll, true);
        view.dom.removeEventListener('keydown', handleEditorKeyDown, true);
        document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
}
