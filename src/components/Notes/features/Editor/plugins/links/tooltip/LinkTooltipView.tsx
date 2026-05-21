import { EditorState } from '@milkdown/kit/prose/state';
import { EditorView } from '@milkdown/kit/prose/view';
import { createRoot, Root } from 'react-dom/client';
import LinkTooltip from './LinkTooltip';
import {
    findLinkElementNearPos,
    hasAdjacentLinkMark,
    hasLinkMarkAroundCursor,
    resolveLinkMarkRangeAtPos,
} from '../utils/helpers';
import {
    applyLinkTooltipPosition,
    getLinkTooltipPositionRoot,
    type LinkTooltipAnchor,
} from './linkTooltipPositioning';
import { installLinkTooltipEvents } from './linkTooltipEvents';
import { LinkTooltipTimers } from './linkTooltipTimers';
import {
    editExistingLink,
    editLinkAtPosition,
    removeExistingLink,
    unlinkExistingLink,
} from './linkTooltipTransactions';
import { openEditorLinkHref } from '../utils/openEditorLinkHref';

const LINK_TOOLTIP_SHOW_DELAY = 70;

export class LinkTooltipView {
    dom: HTMLElement;
    root: Root | null = null;
    view: EditorView;
    positionRoot: HTMLElement | null = null;
    activeLink: HTMLElement | null = null;
    activeAnchor: LinkTooltipAnchor | null = null;
    timers = new LinkTooltipTimers();
    isKeyboardInteraction = false;
    resizeObserver: ResizeObserver | null = null;
    mutationObserver: MutationObserver | null = null;
    cleanupEvents: (() => void) | null = null;

    constructor(view: EditorView) {
        this.view = view;
        this.positionRoot = getLinkTooltipPositionRoot(view);
        this.view.dom.style.whiteSpace = 'pre-wrap';

        this.dom = document.createElement('div');
        this.dom.className = 'link-tooltip-container absolute hidden z-50';
        (this.positionRoot ?? document.body).appendChild(this.dom);
        this.root = createRoot(this.dom);

        this.resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => this.reposition())
            : null;

        this.mutationObserver = typeof MutationObserver !== 'undefined'
            ? new MutationObserver(() => this.reposition())
            : null;

        this.cleanupEvents = installLinkTooltipEvents({
            view: this.view,
            dom: this.dom,
            showLinkWithDelay: (link, shouldValidateCursor) => {
                if (this.activeLink === link) return;
                this.startShowTimer(link, shouldValidateCursor);
            },
            hide: (force) => this.hide(force),
            scheduleFocus: () => this.scheduleFocus(),
            reposition: () => this.reposition(),
            clearHideTimer: () => this.clearHideTimer(),
            startHideTimer: () => this.startHideTimer(),
            clearShowTimer: () => this.clearShowTimer(),
            setKeyboardInteraction: (value) => {
                this.isKeyboardInteraction = value;
            },
            hasActiveLink: () => this.activeLink !== null,
        });
    }

    startShowTimer(link: HTMLElement, shouldValidateCursor = true) {
        this.timers.scheduleShow(() => {
            if (!shouldValidateCursor || hasLinkMarkAroundCursor(this.view.state, this.view.state.selection.$from.pos)) {
                this.show(link);
            }
        }, LINK_TOOLTIP_SHOW_DELAY);
    }
    clearShowTimer() {
        this.timers.clearShow();
    }
    startHideTimer() {
        this.timers.scheduleHide(() => this.hide(), 300);
    }
    clearHideTimer() {
        this.timers.clearHide();
    }
    scheduleFocus() {
        this.timers.scheduleFocus(() => this.view.focus(), 10);
    }

    applyPosition(anchor: LinkTooltipAnchor) {
        applyLinkTooltipPosition({
            view: this.view,
            positionRoot: this.positionRoot,
            tooltipElement: this.dom,
            anchor,
            isEditing: this.dom.hasAttribute('data-editing'),
        });
    }

    reposition() {
        if (this.dom.classList.contains('hidden') || !this.activeAnchor) return;

        if (this.activeAnchor.type === 'link' && !document.contains(this.activeAnchor.link)) {
            this.hide();
            return;
        }

        this.applyPosition(this.activeAnchor);
    }

    handleEdit = (link: HTMLElement, text: string, url: string, shouldClose = false) => {
        const start = editExistingLink(this.view, link, text, url);
        if (start === null) return;

        if (shouldClose) {
            this.hide();
            this.scheduleFocus();
            return;
        }

        this.showLinkAfterDispatch(start);
    };

    show(link: HTMLElement) {
        const href = link.getAttribute('href') || link.getAttribute('data-href');
        if (href === null) return;

        this.activeLink = link;
        this.activeAnchor = { type: 'link', link };

        this.root?.render(
            <LinkTooltip
                key={Date.now()}
                href={href}
                initialText={link.textContent || ''}
                onOpen={() => void openEditorLinkHref(href, { view: this.view })}
                onEdit={(text, url, shouldClose) => this.handleEdit(link, text, url, shouldClose)}
                onUnlink={() => this.handleUnlink(link)}
                onRemove={() => this.handleRemove(link)}
                onClose={() => this.hide()}
            />
        );

        this.dom.classList.remove('hidden');
        this.observePositionDependencies();
        this.applyPosition(this.activeAnchor);
        this.timers.scheduleRaf(() => {
            this.reposition();
        });
    }

    handleUnlink = (link: HTMLElement) => {
        if (unlinkExistingLink(this.view, link)) this.hide();
    };

    handleRemove = (link: HTMLElement) => {
        if (removeExistingLink(this.view, link)) this.hide();
    };

    hide(force = false) {
        if (!force && (this.dom.hasAttribute('data-dropdown-open') || this.dom.hasAttribute('data-editing'))) {
            return;
        }

        this.dom.removeAttribute('data-editing');

        this.dom.classList.add('hidden');
        this.disconnectPositionDependencies();
        this.activeLink = null;
        this.activeAnchor = null;
    }

    update(view: EditorView, prevState?: EditorState) {
        if (this.activeLink && !document.contains(this.activeLink)) this.hide();
        if (!this.isKeyboardInteraction || !prevState || view.state.selection.eq(prevState.selection)) return;

        const pos = view.state.selection.$from.pos;
        if (!hasAdjacentLinkMark(view.state, pos)) {
            this.hideFromKeyboardMove();
            return;
        }

        const range = resolveLinkMarkRangeAtPos(view.state, pos);
        if (!range) return;

        const linkText = view.state.doc.textBetween(range.start, range.end, ' ');
        const trimStart = linkText.search(/\S|$/);
        const trimEnd = linkText.search(/\S\s*$/) + 1;
        const relativePos = pos - range.start;
        const isInsideTrimmed = relativePos > trimStart && relativePos < trimEnd;

        if (!isInsideTrimmed) {
            this.hideFromKeyboardMove();
            return;
        }

        const link = findLinkElementNearPos(view, pos);
        if (link) this.startShowTimer(link, true);
    }

    hideFromKeyboardMove() {
        this.clearShowTimer();
        if (this.activeLink && !this.dom.contains(document.activeElement)) {
            this.startHideTimer();
        }
    }

    showAtPosition(from: number, to: number, autoFocus: boolean) {
        const selectedText = this.view.state.doc.textBetween(from, to, '');

        this.activeLink = null;
        this.activeAnchor = { type: 'range', from, to };

        this.root?.render(
            <LinkTooltip
                key={Date.now()}
                href=""
                initialText={selectedText}
                autoFocus={autoFocus}
                onOpen={() => { }}
                onEdit={(text, url, shouldClose) => this.handleEditAtPosition(from, to, text, url, shouldClose)}
                onUnlink={() => { }}
                onRemove={() => this.hide()}
                onClose={() => this.hide()}
            />
        );

        this.dom.classList.remove('hidden');
        this.observePositionDependencies();
        try {
            this.applyPosition(this.activeAnchor);
            this.timers.scheduleRaf(() => this.reposition());
        } catch {
        }
    }

    handleEditAtPosition = (from: number, to: number, text: string, url: string, shouldClose = false) => {
        const start = editLinkAtPosition(this.view, from, to, text, url);
        if (start === null) {
            this.hide();
            return;
        }

        if (shouldClose) {
            this.hide();
            this.scheduleFocus();
            return;
        }

        this.showLinkAfterDispatch(start);
    };

    showLinkAfterDispatch(start: number) {
        this.timers.scheduleRaf(() => {
            try {
                const link = findLinkElementNearPos(this.view, start + 1);
                if (link) {
                    this.show(link);
                } else {
                    this.hide();
                }
            } catch {
                this.hide();
            }
        });
    }

    destroy() {
        this.clearShowTimer();
        this.clearHideTimer();
        this.timers.clearAll();
        this.cleanupEvents?.();
        this.disconnectPositionDependencies();
        this.root?.unmount();
        this.dom.remove();
    }

    private observePositionDependencies() {
        this.resizeObserver?.observe(this.dom);
        if (this.positionRoot) this.resizeObserver?.observe(this.positionRoot);
        this.mutationObserver?.observe(this.dom, {
            attributes: true,
            attributeFilter: ['data-editing'],
        });
    }

    private disconnectPositionDependencies() {
        this.resizeObserver?.disconnect();
        this.mutationObserver?.disconnect();
    }
}
