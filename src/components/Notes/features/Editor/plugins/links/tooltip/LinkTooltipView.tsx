import { EditorState } from '@milkdown/kit/prose/state';
import { EditorView } from '@milkdown/kit/prose/view';
import { createRoot, type Root } from 'react-dom/client';
import { findLinkElementNearPos } from '../utils/helpers';
import {
    applyLinkTooltipPosition,
    getLinkTooltipPositionRoot,
    type LinkTooltipAnchor,
} from './linkTooltipPositioning';
import { installLinkTooltipEvents } from './linkTooltipEvents';
import { LinkTooltipTimers } from './linkTooltipTimers';
import { getBoundedTextBetween } from '../../shared/selectionTextLimits';
import {
    editExistingLink,
    editLinkAtPosition,
    removeExistingLink,
    unlinkExistingLink,
} from './linkTooltipTransactions';
import { renderExistingLinkTooltip, renderNewLinkTooltip } from './linkTooltipRender';
import {
    applyLinkTooltipEditorWhitespace,
    createLinkTooltipContainer,
    createLinkTooltipMutationObserver,
    createLinkTooltipResizeObserver,
    focusLinkTooltipEditor,
} from './linkTooltipDom';
import { resolveKeyboardLinkTooltipTarget } from './linkTooltipKeyboard';
import {
    scheduleLinkTooltipEditorFocus,
    startLinkTooltipHideTimer,
    startLinkTooltipShowTimer,
} from './linkTooltipTimerActions';

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
    repositionFrameId: number | null = null;

    constructor(view: EditorView) {
        this.view = view;
        this.positionRoot = getLinkTooltipPositionRoot(view);
        applyLinkTooltipEditorWhitespace(this.view.dom);

        this.dom = createLinkTooltipContainer(this.positionRoot);
        this.root = createRoot(this.dom);

        this.resizeObserver = createLinkTooltipResizeObserver(() => this.scheduleReposition());
        this.mutationObserver = createLinkTooltipMutationObserver(() => this.scheduleReposition());

        this.cleanupEvents = installLinkTooltipEvents({
            view: this.view,
            dom: this.dom,
            showLinkWithDelay: (link, shouldValidateCursor) => {
                if (this.activeLink === link) return;
                startLinkTooltipShowTimer(
                    this.timers,
                    this.view,
                    link,
                    (nextLink) => this.show(nextLink),
                    shouldValidateCursor,
                );
            },
            hide: (force) => this.hide(force),
            scheduleFocus: () => scheduleLinkTooltipEditorFocus(this.timers, this.view),
            reposition: () => this.scheduleReposition(),
            clearHideTimer: () => this.timers.clearHide(),
            startHideTimer: () => startLinkTooltipHideTimer(this.timers, () => this.hide()),
            clearShowTimer: () => this.timers.clearShow(),
            setKeyboardInteraction: (value) => {
                this.isKeyboardInteraction = value;
            },
            hasActiveLink: () => this.activeLink !== null,
        });
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

    scheduleReposition() {
        if (this.repositionFrameId !== null) return;
        this.repositionFrameId = requestAnimationFrame(() => {
            this.repositionFrameId = null;
            this.reposition();
        });
    }

    cancelScheduledReposition() {
        if (this.repositionFrameId === null) return;
        cancelAnimationFrame(this.repositionFrameId);
        this.repositionFrameId = null;
    }

    handleEdit = (link: HTMLElement, text: string, url: string, shouldClose = false) => {
        const start = editExistingLink(this.view, link, text, url);
        if (start === null) {
            if (shouldClose) {
                this.hide(true);
                scheduleLinkTooltipEditorFocus(this.timers, this.view);
            }
            return;
        }

        if (shouldClose) {
            this.hide(true);
            scheduleLinkTooltipEditorFocus(this.timers, this.view);
            return;
        }

        this.showLinkAfterDispatch(start);
    };

    show(link: HTMLElement) {
        const href = link.getAttribute('href') || link.getAttribute('data-href');
        if (href === null) return;

        this.activeLink = link;
        this.activeAnchor = { type: 'link', link };

        renderExistingLinkTooltip({
            root: this.root,
            view: this.view,
            containerElement: this.dom,
            link,
            href,
            onEdit: (text, url, shouldClose) => this.handleEdit(link, text, url, shouldClose),
            onUnlink: () => this.handleUnlink(link),
            onRemove: () => this.handleRemove(link),
            onClose: () => this.hide(),
        });

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

        this.timers.clearAll();
        this.dom.removeAttribute('data-editing');

        this.dom.classList.add('hidden');
        this.disconnectPositionDependencies();
        this.cancelScheduledReposition();
        this.activeLink = null;
        this.activeAnchor = null;
    }

    update(view: EditorView, prevState?: EditorState) {
        if (this.activeLink && !document.contains(this.activeLink)) this.hide();
        if (!this.isKeyboardInteraction || !prevState) return;

        const target = resolveKeyboardLinkTooltipTarget(view, prevState);
        if (target === 'hide') {
            this.hideFromKeyboardMove();
            return;
        }
        if (target) startLinkTooltipShowTimer(this.timers, this.view, target, (link) => this.show(link), true);
    }

    hideFromKeyboardMove() {
        this.timers.clearShow();
        if (this.activeLink && !this.dom.contains(document.activeElement)) {
            startLinkTooltipHideTimer(this.timers, () => this.hide());
        }
    }

    showAtPosition(from: number, to: number, autoFocus: boolean) {
        const selectedText = getBoundedTextBetween(this.view.state.doc, from, to, '');

        this.activeLink = null;
        this.activeAnchor = { type: 'range', from, to };

        renderNewLinkTooltip({
            root: this.root,
            containerElement: this.dom,
            selectedText,
            autoFocus,
            onEdit: (text, url, shouldClose) => this.handleEditAtPosition(from, to, text, url, shouldClose),
            onRemove: () => this.hide(),
            onClose: () => this.hide(),
        });

        this.dom.classList.remove('hidden');
        this.observePositionDependencies();
        try {
            this.applyPosition(this.activeAnchor);
            this.timers.scheduleRaf(() => this.reposition());
            if (autoFocus) {
                this.timers.scheduleFocus(() => focusLinkTooltipEditor(this.dom), 0);
                this.timers.scheduleRaf(() => focusLinkTooltipEditor(this.dom));
            }
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
            this.hide(true);
            scheduleLinkTooltipEditorFocus(this.timers, this.view);
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
        this.timers.clearShow();
        this.timers.clearHide();
        this.timers.clearAll();
        this.cleanupEvents?.();
        this.disconnectPositionDependencies();
        this.cancelScheduledReposition();
        const root = this.root;
        this.root = null;
        if (root) {
            window.setTimeout(() => root.unmount(), 0);
        }
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
