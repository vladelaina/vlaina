import { Plugin, PluginKey, EditorState, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { createRoot, Root } from 'react-dom/client';
import LinkTooltip from './LinkTooltip';
import { findLinkRange } from '../utils/helpers';
import {
    getLinkTooltipPositionRoot,
    resolveLinkTooltipPosition,
    type LinkTooltipAnchor,
} from './linkTooltipPositioning';

export const linkTooltipPluginKey = new PluginKey('link-tooltip');

const LINK_TOOLTIP_SHOW_DELAY = 180;

type LinkTooltipPluginState = {
    shouldShow: boolean;
    from: number;
    to: number;
    autoFocus: boolean;
    handled: boolean;
    visibleSelectionFrom: number | null;
    visibleSelectionTo: number | null;
};

function resolveTooltipEligibleLink(target: HTMLElement | null): HTMLElement | null {
    if (!target) {
        return null;
    }

    const tocLink = target.closest('.toc-link[data-heading-pos]');
    if (tocLink instanceof HTMLElement) {
        return null;
    }

    const link = target.closest('.autolink') || target.closest('a[href]');
    return link instanceof HTMLElement ? link : null;
}

class LinkTooltipView {
    dom: HTMLElement;
    root: Root | null = null;
    view: EditorView;
    positionRoot: HTMLElement | null = null;
    activeLink: HTMLElement | null = null;
    activeAnchor: LinkTooltipAnchor | null = null;
    hideTimer: number | null = null;
    showTimer: number | null = null;
    focusTimer: number | null = null;
    pendingRafs: Set<number> = new Set();
    isKeyboardInteraction: boolean = false;
    resizeObserver: ResizeObserver | null = null;
    mutationObserver: MutationObserver | null = null;

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
        this.resizeObserver?.observe(this.dom);
        if (this.positionRoot) {
            this.resizeObserver?.observe(this.positionRoot);
        }

        this.mutationObserver = typeof MutationObserver !== 'undefined'
            ? new MutationObserver(() => this.reposition())
            : null;
        this.mutationObserver?.observe(this.dom, {
            attributes: true,
            attributeFilter: ['data-editing'],
        });

        this.view.dom.addEventListener('mouseover', this.handleEditorMouseOver);
        this.view.dom.addEventListener('mouseout', this.handleEditorMouseOut);
        this.view.dom.addEventListener('mousedown', this.handleEditorMouseDown, true);

        this.dom.addEventListener('mouseenter', this.handleTooltipMouseEnter);
        this.dom.addEventListener('mouseleave', this.handleTooltipMouseLeave);

        // Hide tooltip on scroll
        window.addEventListener('scroll', this.handleScroll, true);

        this.view.dom.addEventListener('keydown', this.handleEditorKeyDown, true);
        document.addEventListener('keydown', this.handleGlobalKeyDown, true);
    }

    handleGlobalKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && !this.dom.classList.contains('hidden')) {
            event.preventDefault();
            event.stopPropagation();
            this.hide(true);
            this.scheduleFocus();
        }
    };

    handleScroll = () => {
        if (this.dom.hasAttribute('data-editing')) {
            this.reposition();
            return;
        }
        if (this.activeLink) {
            this.hide();
        }
    };

    handleEditorMouseDown = async (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const link = resolveTooltipEligibleLink(target);

        if (link) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const href = link.getAttribute('href') || link.getAttribute('data-href');
            if (href) {
                await openExternalHref(href);
            }
        } else {
            this.isKeyboardInteraction = false;
        }
    };

    handleEditorMouseOver = (e: Event) => {
        const target = e.target as HTMLElement;
        const link = resolveTooltipEligibleLink(target);

        if (link) {
            this.clearHideTimer();
            if (this.activeLink === link) return;
            this.startShowTimer(link as HTMLElement, false);
        }
    };

    handleEditorMouseOut = (e: Event) => {
        const target = e.target as HTMLElement;
        const link = resolveTooltipEligibleLink(target);

        if (link) {
            this.clearShowTimer();
            this.startHideTimer();
        }
    };

    handleTooltipMouseEnter = () => {
        this.clearHideTimer();
    };

    handleTooltipMouseLeave = (e: MouseEvent) => {
        if (this.dom.hasAttribute('data-dropdown-open')) {
            return;
        }

        const relatedTarget = e.relatedTarget as HTMLElement | null;
        if (relatedTarget) {
            const isRadixDropdown = relatedTarget.closest('[data-radix-popper-content-wrapper]') ||
                relatedTarget.closest('[role="menu"]');
            if (isRadixDropdown) {
                return;
            }
        }

        this.startHideTimer();
    };

    startShowTimer(link: HTMLElement, shouldValidateCursor: boolean = true) {
        this.clearShowTimer();
        this.showTimer = window.setTimeout(() => {
            if (!shouldValidateCursor) {
                this.show(link);
                return;
            }

            const { selection } = this.view.state;
            const { $from } = selection;
            const nodeBeforeHasLink = $from.nodeBefore?.marks?.some(m => m.type.name === 'link') === true;
            const nodeAfterHasLink = $from.nodeAfter?.marks?.some(m => m.type.name === 'link') === true;

            if (nodeBeforeHasLink && nodeAfterHasLink) {
                this.show(link);
            }
        }, LINK_TOOLTIP_SHOW_DELAY);
    }

    scheduleRaf(callback: () => void) {
        const id = requestAnimationFrame(() => {
            this.pendingRafs.delete(id);
            callback();
        });
        this.pendingRafs.add(id);
    }

    cancelAllRafs() {
        for (const id of this.pendingRafs) {
            cancelAnimationFrame(id);
        }
        this.pendingRafs.clear();
    }

    clearShowTimer() {
        if (this.showTimer) {
            clearTimeout(this.showTimer);
            this.showTimer = null;
        }
    }

    startHideTimer() {
        this.clearHideTimer();
        this.hideTimer = window.setTimeout(() => {
            this.hide();
        }, 300);
    }

    clearHideTimer() {
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }

    scheduleFocus() {
        this.clearFocusTimer();
        this.focusTimer = window.setTimeout(() => this.view.focus(), 10);
    }

    clearFocusTimer() {
        if (this.focusTimer) {
            clearTimeout(this.focusTimer);
            this.focusTimer = null;
        }
    }

    applyPosition(anchor: LinkTooltipAnchor) {
        const isEditing = this.dom.hasAttribute('data-editing');
        const position = resolveLinkTooltipPosition({
            view: this.view,
            positionRoot: this.positionRoot,
            tooltipElement: this.dom,
            anchor,
            isEditing,
        });

        this.dom.style.left = `${position.x}px`;
        this.dom.style.top = `${position.y}px`;
        this.dom.style.transform = position.transform;
        this.dom.style.transformOrigin = position.transformOrigin;
    }

    clearVisibleSelection() {
        const pluginState = linkTooltipPluginKey.getState(this.view.state) as LinkTooltipPluginState | undefined;
        if (
            !pluginState ||
            pluginState.visibleSelectionFrom == null ||
            pluginState.visibleSelectionTo == null
        ) {
            return;
        }

        this.view.dispatch(
            this.view.state.tr.setMeta(linkTooltipPluginKey, {
                type: 'CLEAR_LINK_TOOLTIP_SELECTION',
            })
        );
    }

    reposition() {
        if (this.dom.classList.contains('hidden') || !this.activeAnchor) {
            return;
        }

        if (this.activeAnchor.type === 'link' && !document.contains(this.activeAnchor.link)) {
            this.hide();
            return;
        }

        this.applyPosition(this.activeAnchor);
    }

    handleEdit = (link: HTMLElement, text: string, url: string, shouldClose: boolean = false) => {
        const pos = this.view.posAtDOM(link, 0);
        if (pos < 0) return;

        const { state, dispatch } = this.view;
        const $pos = state.doc.resolve(pos);
        const linkMarkType = state.schema.marks.link;
        if (!linkMarkType) return;

        let absoluteStart = pos;
        let absoluteEnd = pos;

        const hasMark = linkMarkType.isInSet($pos.marks()) ||
            ($pos.nodeAfter && linkMarkType.isInSet($pos.nodeAfter.marks));

        if (hasMark) {
            let scanForwards = pos;
            while (scanForwards < state.doc.content.size) {
                const $scan = state.doc.resolve(scanForwards);
                const marks = $scan.marks().concat($scan.nodeAfter?.marks || []);
                if (!linkMarkType.isInSet(marks)) {
                    break;
                }
                scanForwards++;
            }
            let scanBackwards = pos;
            while (scanBackwards > 0) {
                const marksBefore = state.doc.resolve(scanBackwards - 1).marks();
                if (!linkMarkType.isInSet(marksBefore)) {
                    break;
                }
                scanBackwards--;
            }

            absoluteStart = scanBackwards;
            absoluteEnd = scanForwards;
        } else {
            const length = link.textContent?.length || 0;
            absoluteStart = pos;
            absoluteEnd = pos + length;
        }

        if (absoluteStart === absoluteEnd) {
            const length = link.textContent?.length || 0;
            absoluteEnd = absoluteStart + length;
        }

        let tr = state.tr;

        if (hasMark) {
            tr = tr.removeMark(absoluteStart, absoluteEnd, linkMarkType);
        }

        tr = tr
            .insertText(text, absoluteStart, absoluteEnd)
            .addMark(absoluteStart, absoluteStart + text.length, linkMarkType.create({ href: url }));

        // Ensure cursor is placed at the end of the link
        const newLinkEnd = absoluteStart + text.length;
        tr.setSelection(TextSelection.create(tr.doc, newLinkEnd));

        dispatch(tr);

        if (shouldClose) {
            this.hide();
            this.scheduleFocus();
            return;
        }

        // Don't hide! Find the new link and keep showing it.
        // Use RAF to ensure DOM is fully updated before reading textContent
        this.scheduleRaf(() => {
            try {
                const newStart = tr.mapping.map(absoluteStart);
                const domInfo = this.view.domAtPos(newStart + 1);

                let newLink = domInfo.node as HTMLElement;
                if (newLink.nodeType === Node.TEXT_NODE) {
                    newLink = newLink.parentElement as HTMLElement;
                }
                if (newLink && newLink.tagName !== 'A') {
                    newLink = newLink.closest('a') as HTMLElement;
                }

                if (newLink) {
                    this.show(newLink);
                } else {
                    this.hide();
                }
            } catch {
                this.hide();
            }
        });
    };

    show(link: HTMLElement) {
        if (this.activeLink && this.activeLink !== link) {
            this.activeLink.classList.remove('link-active-state');
        }

        this.activeLink = link;
        this.activeAnchor = { type: 'link', link };
        link.classList.add('link-active-state');

        const href = link.getAttribute('href') || link.getAttribute('data-href');
        // Allow empty string (newly created links), only return if null
        if (href === null) return;

        this.root?.render(
            <LinkTooltip
                key={Date.now()}
                href={href}
                initialText={link.textContent || ''}
                onEdit={(text, url, shouldClose) => this.handleEdit(link, text, url, shouldClose)}
                onUnlink={() => this.handleUnlink(link)}
                onRemove={() => this.handleRemove(link)}
                onClose={() => this.hide()}
            />
        );

        this.dom.classList.remove('hidden');
        this.applyPosition(this.activeAnchor);
        this.scheduleRaf(() => this.reposition());
    }

    handleUnlink = (link: HTMLElement) => {
        const result = findLinkRange(this.view, link);
        if (!result) return;

        const { start, end, linkMarkType } = result;
        const { state, dispatch } = this.view;

        // Remove just the link mark, keep the text
        const tr = state.tr.removeMark(start, end, linkMarkType);
        dispatch(tr);
        this.hide();
    };

    handleRemove = (link: HTMLElement) => {
        const result = findLinkRange(this.view, link);
        if (!result) return;

        const { start, end } = result;
        const { state, dispatch } = this.view;

        // Delete the entire range
        const tr = state.tr.delete(start, end);
        dispatch(tr);
        this.hide();
    };

    hide(force: boolean = false) {
        if (!force && (this.dom.hasAttribute('data-dropdown-open') || this.dom.hasAttribute('data-editing'))) {
            return;
        }

        this.dom.removeAttribute('data-editing');
        document.documentElement.removeAttribute('data-link-selection-visible');
        document.body.removeAttribute('data-link-selection-visible');

        if (this.activeLink) {
            this.activeLink.classList.remove('link-active-state');
        }

        this.dom.classList.add('hidden');
        this.activeLink = null;
        this.activeAnchor = null;
        this.clearVisibleSelection();
    }

    update(view: EditorView, prevState?: EditorState) {
        if (this.activeLink && !document.contains(this.activeLink)) {
            this.hide();
        }

        if (this.isKeyboardInteraction && prevState && !view.state.selection.eq(prevState.selection)) {
            const { selection } = view.state;
            const { $from } = selection;

            const nodeBeforeHasLink = $from.nodeBefore?.marks?.some(m => m.type.name === 'link') === true;
            const nodeAfterHasLink = $from.nodeAfter?.marks?.some(m => m.type.name === 'link') === true;

            if (nodeBeforeHasLink || nodeAfterHasLink) {
                const linkMarkType = view.state.schema.marks.link;
                if (!linkMarkType) return;

                const pos = $from.pos;
                let start = pos;
                let end = pos;

                let scanBack = pos;
                while (scanBack > 0) {
                    const prevNode = view.state.doc.resolve(scanBack - 1);
                    const marks = prevNode.marks();
                    if (!linkMarkType.isInSet(marks)) break;
                    scanBack--;
                }
                start = scanBack;

                let scanForward = pos;
                while (scanForward < view.state.doc.content.size) {
                    const nextNode = view.state.doc.resolve(scanForward);
                    const marks = nextNode.marks().concat(nextNode.nodeAfter?.marks || []);
                    if (!linkMarkType.isInSet(marks)) break;
                    scanForward++;
                }
                end = scanForward;

                const linkText = view.state.doc.textBetween(start, end, ' ');

                const trimStart = linkText.search(/\S|$/);
                const trimEnd = linkText.search(/\S\s*$/) + 1;

                const relativePos = pos - start;

                const isInsideTrimmed = relativePos > trimStart && relativePos < trimEnd;

                if (isInsideTrimmed) {
                    const domInfo = view.domAtPos(pos);
                    let node = domInfo.node as HTMLElement;
                    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement as HTMLElement;
                    if (node && node.tagName !== 'A') node = node.closest('a') as HTMLElement;

                    if (node) {
                        this.startShowTimer(node, true);
                    }
                } else {
                    this.clearShowTimer();
                    if (this.activeLink && !this.dom.contains(document.activeElement)) {
                        this.startHideTimer();
                    }
                }
            } else {
                this.clearShowTimer();
                if (this.activeLink && !this.dom.contains(document.activeElement)) {
                    this.startHideTimer();
                }
            }
        }
    }

    handleEditorKeyDown = (event: KeyboardEvent): void => {
        this.isKeyboardInteraction = true;

        if (event.key === 'Tab' && !this.dom.classList.contains('hidden')) {
            event.preventDefault();
            const firstFocusable = this.dom.querySelector('button, input') as HTMLElement;
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }
    };

    showAtPosition(from: number, to: number, autoFocus: boolean) {
        const { state } = this.view;
        const selectedText = state.doc.textBetween(from, to, '');

        this.activeLink = null;
        this.activeAnchor = { type: 'range', from, to };

        this.root?.render(
            <LinkTooltip
                key={Date.now()}
                href=""
                initialText={selectedText}
                autoFocus={autoFocus}
                onEdit={(text, url, shouldClose) => this.handleEditAtPosition(from, to, text, url, shouldClose)}
                onUnlink={() => { /* New links have no href to unlink */ }}
                onRemove={() => this.hide()}
                onClose={() => this.hide()}
            />
        );

        this.dom.classList.remove('hidden');
        try {
            this.applyPosition(this.activeAnchor);
            requestAnimationFrame(() => this.reposition());
        } catch {
        }
    }

    handleEditAtPosition = (from: number, to: number, text: string, url: string, shouldClose: boolean = false) => {
        const { state, dispatch } = this.view;
        const linkMarkType = state.schema.marks.link;
        if (!linkMarkType) return;

        if (!url || url.trim() === '') {
            const tr = state.tr.removeMark(from, to, linkMarkType);
            dispatch(tr);
            this.hide();
            return;
        }

        const tr = state.tr
            .insertText(text, from, to)
            .addMark(from, from + text.length, linkMarkType.create({ href: url }));

        const newLinkEnd = from + text.length;
        tr.setSelection(TextSelection.create(tr.doc, newLinkEnd));

        dispatch(tr);
        this.clearVisibleSelection();

        if (shouldClose) {
            this.hide();
            this.scheduleFocus();
            return;
        }

        this.scheduleRaf(() => {
            try {
                const newStart = tr.mapping.map(from);
                const domInfo = this.view.domAtPos(newStart + 1);

                let newLink = domInfo.node as HTMLElement;
                if (newLink.nodeType === Node.TEXT_NODE) {
                    newLink = newLink.parentElement as HTMLElement;
                }
                if (newLink && newLink.tagName !== 'A') {
                    newLink = newLink.closest('a') as HTMLElement;
                }

                if (newLink) {
                    this.show(newLink);
                } else {
                    this.hide();
                }
            } catch {
                this.hide();
            }
        });
    };

    destroy() {
        this.clearShowTimer();
        this.clearHideTimer();
        this.clearFocusTimer();
        this.cancelAllRafs();
        this.view.dom.removeEventListener('mouseover', this.handleEditorMouseOver);
        this.view.dom.removeEventListener('mouseout', this.handleEditorMouseOut);
        this.view.dom.removeEventListener('mousedown', this.handleEditorMouseDown, true);
        this.dom.removeEventListener('mouseenter', this.handleTooltipMouseEnter);
        this.dom.removeEventListener('mouseleave', this.handleTooltipMouseLeave);
        window.removeEventListener('scroll', this.handleScroll, true);
        this.view.dom.removeEventListener('keydown', this.handleEditorKeyDown, true);
        document.removeEventListener('keydown', this.handleGlobalKeyDown, true);
        this.resizeObserver?.disconnect();
        this.mutationObserver?.disconnect();
        this.dom.remove();
        this.root?.unmount();
    }
}

export const linkTooltipPlugin = $prose(() => {
    return new Plugin({
        key: linkTooltipPluginKey,
        state: {
            init: (): LinkTooltipPluginState => ({
                shouldShow: false,
                from: 0,
                to: 0,
                autoFocus: false,
                handled: false,
                visibleSelectionFrom: null,
                visibleSelectionTo: null,
            }),
            apply(tr, value) {
                const meta = tr.getMeta(linkTooltipPluginKey);
                const nextValue = tr.docChanged
                    ? {
                        ...value,
                        visibleSelectionFrom: value.visibleSelectionFrom == null
                            ? null
                            : tr.mapping.map(value.visibleSelectionFrom),
                        visibleSelectionTo: value.visibleSelectionTo == null
                            ? null
                            : tr.mapping.map(value.visibleSelectionTo),
                    }
                    : value;

                // New show request
                if (meta && meta.type === 'SHOW_LINK_TOOLTIP') {
                    return {
                        ...nextValue,
                        shouldShow: true,
                        from: meta.from,
                        to: meta.to,
                        autoFocus: meta.autoFocus === true,
                        handled: false,
                        visibleSelectionFrom: meta.from,
                        visibleSelectionTo: meta.to,
                    };
                }

                // Clear request
                if (meta && meta.type === 'CLEAR_LINK_TOOLTIP') {
                    return {
                        ...nextValue,
                        shouldShow: false,
                        from: 0,
                        to: 0,
                        autoFocus: false,
                        handled: false,
                    };
                }

                if (meta && meta.type === 'CLEAR_LINK_TOOLTIP_SELECTION') {
                    return {
                        ...nextValue,
                        visibleSelectionFrom: null,
                        visibleSelectionTo: null,
                    };
                }

                // Preserve existing state for other transactions
                return nextValue;
            }
        },
        props: {
            decorations(state) {
                const pluginState = linkTooltipPluginKey.getState(state) as LinkTooltipPluginState | undefined;
                if (
                    !pluginState ||
                    pluginState.visibleSelectionFrom == null ||
                    pluginState.visibleSelectionTo == null ||
                    pluginState.visibleSelectionFrom >= pluginState.visibleSelectionTo
                ) {
                    return null;
                }

                return DecorationSet.create(state.doc, [
                    Decoration.inline(
                        pluginState.visibleSelectionFrom,
                        pluginState.visibleSelectionTo,
                        { class: 'vlaina-link-selection-visible' }
                    ),
                ]);
            },
        },
        view(editorView) {
            const tooltipView = new LinkTooltipView(editorView);
            let pendingShowTimer: number | null = null;

            return {
                update(view, prevState) {
                    tooltipView.update(view, prevState);

                    const pluginState = linkTooltipPluginKey.getState(view.state);

                    if (pluginState?.shouldShow && !pluginState.handled) {
                        const { from, to, autoFocus } = pluginState;

                        view.dispatch(view.state.tr.setMeta(linkTooltipPluginKey, { type: 'CLEAR_LINK_TOOLTIP' }));

                        if (pendingShowTimer != null) clearTimeout(pendingShowTimer);
                        pendingShowTimer = window.setTimeout(() => {
                            pendingShowTimer = null;
                            tooltipView.showAtPosition(from, to, autoFocus);
                        }, 50);
                    }
                },
                destroy() {
                    if (pendingShowTimer != null) clearTimeout(pendingShowTimer);
                    tooltipView.destroy();
                },
            };
        },
    });
});
