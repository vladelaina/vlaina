import { Plugin, PluginKey, EditorState, TextSelection } from '@milkdown/kit/prose/state';
import { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { createRoot, Root } from 'react-dom/client';
import LinkTooltip from './LinkTooltip';
import { findLinkRange } from '../utils/helpers';

export const linkTooltipPluginKey = new PluginKey('link-tooltip');

class LinkTooltipView {
    dom: HTMLElement;
    root: Root | null = null;
    view: EditorView;
    activeLink: HTMLElement | null = null;
    hideTimer: number | null = null;
    showTimer: number | null = null;
    isKeyboardInteraction: boolean = false;

    constructor(view: EditorView) {
        this.view = view;

        // Fix ProseMirror warning: requires white-space to be set
        this.view.dom.style.whiteSpace = 'pre-wrap';

        this.dom = document.createElement('div');
        this.dom.className = 'link-tooltip-container absolute hidden z-50 transition-all duration-200 ease-out';
        document.body.appendChild(this.dom);

        this.root = createRoot(this.dom);

        this.view.dom.addEventListener('mouseover', this.handleEditorMouseOver);
        this.view.dom.addEventListener('mouseout', this.handleEditorMouseOut);
        // Use capture to ensure we intercept before editor internal selection logic
        // mousedown executes the navigation and prevents editor cursor movement
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
            this.hide();
            // Restore focus with a slight delay to allow UI to update
            setTimeout(() => this.view.focus(), 10);
        }
    };

    handleScroll = () => {
        // Don't hide during edit mode (IME input can trigger scroll events)
        if (this.dom.hasAttribute('data-editing')) {
            return;
        }
        if (this.activeLink) {
            this.hide();
        }
    };

    handleEditorMouseDown = async (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const link = target.closest('.autolink') || target.closest('a[href]');

        // Direct click on link: open it immediately and prevent editor cursor movement
        // Note: We must call preventDefault/stopPropagation BEFORE async operations
        // to prevent Ctrl+Click from triggering block selection
        if (link) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const href = link.getAttribute('href') || link.getAttribute('data-href');
            if (href) {
                try {
                    const { openUrl } = await import('@tauri-apps/plugin-opener');
                    await openUrl(href);
                } catch (err) {
                    // Fallback to window.open if Tauri API fails
                    console.warn('[LinkClick] Tauri openUrl failed, using fallback:', err);
                    window.open(href, '_blank', 'noopener,noreferrer');
                }
            }
        } else {
            // Regular click inside editor, treat as mouse interaction
            this.isKeyboardInteraction = false;
        }
    };

    handleEditorMouseOver = (e: Event) => {
        const target = e.target as HTMLElement;
        const link = target.closest('.autolink') || target.closest('a[href]');

        if (link) {
            this.clearHideTimer();
            if (this.activeLink === link) return;
            // Hover trigger - skip cursor validation
            this.startShowTimer(link as HTMLElement, false);
        }
    };

    handleEditorMouseOut = (e: Event) => {
        const target = e.target as HTMLElement;
        const link = target.closest('.autolink') || target.closest('a[href]');

        if (link) {
            this.clearShowTimer();
            this.startHideTimer();
        }
    };

    handleTooltipMouseEnter = () => {
        this.clearHideTimer();
    };

    handleTooltipMouseLeave = (e: MouseEvent) => {
        // Don't hide if dropdown menu is open
        if (this.dom.hasAttribute('data-dropdown-open')) {
            return;
        }

        // Don't hide if mouse is moving to the Radix dropdown portal
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

            // Re-validate: check if cursor is still inside a link
            const { selection } = this.view.state;
            const { $from } = selection;
            const nodeBeforeHasLink = $from.nodeBefore?.marks?.some(m => m.type.name === 'link') === true;
            const nodeAfterHasLink = $from.nodeAfter?.marks?.some(m => m.type.name === 'link') === true;

            if (nodeBeforeHasLink && nodeAfterHasLink) {
                this.show(link);
            }
        }, 500);
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

    updatePosition(link: HTMLElement) {
        const rect = link.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

        this.dom.style.top = `${rect.bottom + scrollTop + 8}px`;
        this.dom.style.left = `${rect.left + scrollLeft}px`;
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
            setTimeout(() => this.view.focus(), 10); // Restore focus with delay
            return;
        }

        // Don't hide! Find the new link and keep showing it.
        // Use RAF to ensure DOM is fully updated before reading textContent
        requestAnimationFrame(() => {
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
                    // Determine if we need to force a refresh even if it's arguably the "same" link
                    // Forcing show() will re-render React component with new props (href/text)
                    this.show(newLink);
                } else {
                    this.hide();
                }
            } catch (e) {
                console.warn('Failed to locate new link node after edit', e);
                this.hide();
            }
        });
    };

    show(link: HTMLElement) {
        if (this.activeLink && this.activeLink !== link) {
            this.activeLink.classList.remove('link-active-state');
        }

        this.activeLink = link;
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
        this.updatePosition(link);
        requestAnimationFrame(() => this.updatePosition(link));
    }

    /**
     * Remove link mark but keep the text content
     */
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

    /**
     * Remove the entire link element (both text and mark)
     */
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

    hide() {
        // Don't hide if dropdown menu is open or in editing mode
        if (this.dom.hasAttribute('data-dropdown-open') || this.dom.hasAttribute('data-editing')) {
            return;
        }

        if (this.activeLink) {
            this.activeLink.classList.remove('link-active-state');
        }

        this.dom.classList.add('hidden');
        this.activeLink = null;
    }

    update(view: EditorView, prevState?: EditorState) {
        // Check if active link is still valid and in the document
        if (this.activeLink && !document.contains(this.activeLink)) {
            this.hide();
        }

        // Auto-show tooltip when caret enters a link
        // Only trigger if interaction was via keyboard (to avoid annoying popups on click)
        if (this.isKeyboardInteraction && prevState && !view.state.selection.eq(prevState.selection)) {
            const { selection } = view.state;
            const { $from } = selection;

            // Check marks on the characters before and after cursor
            const nodeBeforeHasLink = $from.nodeBefore?.marks?.some(m => m.type.name === 'link') === true;
            const nodeAfterHasLink = $from.nodeAfter?.marks?.some(m => m.type.name === 'link') === true;

            // Initial check: must be physically inside or at boundary of a link
            if (nodeBeforeHasLink || nodeAfterHasLink) {
                // Find the full extent of the link to handle whitespace
                const linkMarkType = view.state.schema.marks.link;
                if (!linkMarkType) return;

                const pos = $from.pos;
                let start = pos;
                let end = pos;

                // Scan backwards
                let scanBack = pos;
                while (scanBack > 0) {
                    const prevNode = view.state.doc.resolve(scanBack - 1);
                    const marks = prevNode.marks();
                    if (!linkMarkType.isInSet(marks)) break;
                    scanBack--;
                }
                start = scanBack;

                // Scan forwards
                let scanForward = pos;
                while (scanForward < view.state.doc.content.size) {
                    const nextNode = view.state.doc.resolve(scanForward);
                    const marks = nextNode.marks().concat(nextNode.nodeAfter?.marks || []);
                    if (!linkMarkType.isInSet(marks)) break;
                    scanForward++;
                }
                end = scanForward;

                // Get the full link text
                const linkText = view.state.doc.textBetween(start, end, ' ');

                // Calculate effective boundaries (ignoring whitespace)
                const trimStart = linkText.search(/\S|$/); // First non-whitespace
                const trimEnd = linkText.search(/\S\s*$/) + 1; // End of last non-whitespace

                const relativePos = pos - start;

                // Show ONLY if cursor is strictly inside the non-whitespace content
                // If text is all whitespace, trimStart=0, trimEnd=1 (empty found at 0).
                const isInsideTrimmed = relativePos > trimStart && relativePos < trimEnd;

                if (isInsideTrimmed) {
                    // One final check: ensure we can find the DOM node
                    const domInfo = view.domAtPos(pos);
                    let node = domInfo.node as HTMLElement;
                    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement as HTMLElement;
                    if (node && node.tagName !== 'A') node = node.closest('a') as HTMLElement;

                    if (node) {
                        this.startShowTimer(node, true);
                    }
                } else {
                    // Inside link track but outside meaningful content (e.g. trailing space)
                    // Treat as boundary -> clear/hide
                    this.clearShowTimer();
                    if (this.activeLink && !this.dom.contains(document.activeElement)) {
                        this.startHideTimer();
                    }
                }
            } else {
                // Completely outside link
                this.clearShowTimer();
                if (this.activeLink && !this.dom.contains(document.activeElement)) {
                    this.startHideTimer();
                }
            }
        }
    }

    handleEditorKeyDown = (event: KeyboardEvent): void => {
        // Any key press in editor counts as keyboard interaction
        this.isKeyboardInteraction = true;

        // Tab key to enter toolbar
        if (event.key === 'Tab' && !this.dom.classList.contains('hidden')) {
            event.preventDefault();
            // Focus the first actionable item
            const firstFocusable = this.dom.querySelector('button, input') as HTMLElement;
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }
    };

    /**
     * Show the tooltip at a specific position range, without requiring a DOM <a> element.
     * This is used when creating new links (empty href) which may not render as <a> tags.
     */
    showAtPosition(from: number, to: number) {
        // Get the selected text
        const { state } = this.view;
        const selectedText = state.doc.textBetween(from, to, '');

        // Create a virtual element reference for positioning
        this.activeLink = null; // We don't have a real link element

        // Render the tooltip component
        this.root?.render(
            <LinkTooltip
                key={Date.now()}
                href=""
                initialText={selectedText}
                onEdit={(text, url, shouldClose) => this.handleEditAtPosition(from, to, text, url, shouldClose)}
                onUnlink={() => { /* New links have no href to unlink */ }}
                onRemove={() => this.hide()}
                onClose={() => this.hide()}
            />
        );

        this.dom.classList.remove('hidden');
        this.updatePositionFromCoords(from, to);
    }

    /**
     * Update tooltip position using ProseMirror coordinates instead of DOM element.
     */
    updatePositionFromCoords(from: number, to: number) {
        try {
            const startCoords = this.view.coordsAtPos(from);
            const endCoords = this.view.coordsAtPos(to);
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

            // Position below the text, centered between start and end
            const left = (startCoords.left + endCoords.right) / 2;
            const bottom = Math.max(startCoords.bottom, endCoords.bottom);

            this.dom.style.top = `${bottom + scrollTop + 8}px`;
            this.dom.style.left = `${left + scrollLeft}px`;
        } catch (e) {
            console.warn('[LinkTooltipPlugin] Failed to get coords:', e);
        }
    }

    /**
     * Handle edit for a link at a specific position range (no DOM element).
     */
    handleEditAtPosition = (from: number, to: number, text: string, url: string, shouldClose: boolean = false) => {
        const { state, dispatch } = this.view;
        const linkMarkType = state.schema.marks.link;
        if (!linkMarkType) return;

        // Cancel if URL is empty
        if (!url || url.trim() === '') {
            // Remove the empty link mark if it exists
            const tr = state.tr.removeMark(from, to, linkMarkType);
            dispatch(tr);
            this.hide();
            return;
        }

        // Replace text and add link mark with the new URL
        const tr = state.tr
            .insertText(text, from, to)
            .addMark(from, from + text.length, linkMarkType.create({ href: url }));

        // Ensure cursor is placed at the end of the link
        const newLinkEnd = from + text.length;
        tr.setSelection(TextSelection.create(tr.doc, newLinkEnd));

        dispatch(tr);

        if (shouldClose) {
            this.hide();
            setTimeout(() => this.view.focus(), 10);
            return;
        }

        // Try to find and show the new link
        // Use RAF to ensure DOM is fully updated before reading textContent
        requestAnimationFrame(() => {
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
            } catch (e) {
                console.warn('Failed to locate new link node after edit', e);
                this.hide();
            }
        });
    };

    destroy() {
        this.clearShowTimer();
        this.clearHideTimer();
        this.view.dom.removeEventListener('mouseover', this.handleEditorMouseOver);
        this.view.dom.removeEventListener('mouseout', this.handleEditorMouseOut);
        this.view.dom.removeEventListener('mousedown', this.handleEditorMouseDown, true);
        this.dom.removeEventListener('mouseenter', this.handleTooltipMouseEnter);
        this.dom.removeEventListener('mouseleave', this.handleTooltipMouseLeave);
        window.removeEventListener('scroll', this.handleScroll, true);
        this.view.dom.removeEventListener('keydown', this.handleEditorKeyDown);
        document.removeEventListener('keydown', this.handleGlobalKeyDown, true);
        this.dom.remove();
        this.root?.unmount();
    }
}

export const linkTooltipPlugin = $prose(() => {
    return new Plugin({
        key: linkTooltipPluginKey,
        state: {
            init: () => ({ shouldShow: false, from: 0, to: 0, handled: false }),
            apply(tr, value) {
                const meta = tr.getMeta(linkTooltipPluginKey);

                // New show request
                if (meta && meta.type === 'SHOW_LINK_TOOLTIP') {
                    return { shouldShow: true, from: meta.from, to: meta.to, handled: false };
                }

                // Clear request
                if (meta && meta.type === 'CLEAR_LINK_TOOLTIP') {
                    return { shouldShow: false, from: 0, to: 0, handled: false };
                }

                // Preserve existing state for other transactions
                return value;
            }
        },
        view(editorView) {
            const tooltipView = new LinkTooltipView(editorView);

            return {
                update(view, prevState) {
                    tooltipView.update(view, prevState);

                    const pluginState = linkTooltipPluginKey.getState(view.state);

                    // Only process if shouldShow is true AND not already handled
                    if (pluginState?.shouldShow && !pluginState.handled) {

                        // Mark as handled immediately to prevent duplicate calls
                        // We do this by dispatching a transaction that marks it handled
                        const { from, to } = pluginState;

                        // Dispatch immediately to clean the state and mark as handled
                        view.dispatch(view.state.tr.setMeta(linkTooltipPluginKey, { type: 'CLEAR_LINK_TOOLTIP' }));

                        // Use setTimeout to let any pending DOM updates complete
                        setTimeout(() => {
                            tooltipView.showAtPosition(from, to);
                        }, 50);
                    }
                },
                destroy() {
                    tooltipView.destroy();
                },
            };
        },
    });
});