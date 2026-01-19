import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { createRoot, Root } from 'react-dom/client';
import LinkTooltip from './LinkTooltip';

export const linkTooltipPluginKey = new PluginKey('link-tooltip');

class LinkTooltipView {
    dom: HTMLElement;
    root: Root | null = null;
    view: EditorView;
    activeLink: HTMLElement | null = null;
    hideTimer: number | null = null;
    showTimer: number | null = null;

    constructor(view: EditorView) {
        this.view = view;

        this.dom = document.createElement('div');
        this.dom.className = 'link-tooltip-container absolute hidden z-50 transition-all duration-200 ease-out';
        document.body.appendChild(this.dom);

        this.root = createRoot(this.dom);

        this.view.dom.addEventListener('mouseover', this.handleEditorMouseOver);
        this.view.dom.addEventListener('mouseout', this.handleEditorMouseOut);
        // Use capture to ensure we intercept before editor internal selection logic
        this.view.dom.addEventListener('mousedown', this.handleEditorMouseDown, true);

        this.dom.addEventListener('mouseenter', this.handleTooltipMouseEnter);
        this.dom.addEventListener('mouseleave', this.handleTooltipMouseLeave);

        // Hide tooltip on scroll
        window.addEventListener('scroll', this.handleScroll, true);
    }

    handleScroll = () => {
        // Don't hide during edit mode (IME input can trigger scroll events)
        if (this.dom.hasAttribute('data-editing')) {
            return;
        }
        if (this.activeLink) {
            this.hide();
        }
    };

    handleEditorMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const link = target.closest('.autolink') || target.closest('a[href]');

        if (link && (e.metaKey || e.ctrlKey)) {
            // Aggressively prevent default selection AND open the link immediately
            const href = link.getAttribute('href') || link.getAttribute('data-href');
            if (href) {
                window.open(href, '_blank', 'noopener,noreferrer');
            }

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    };

    handleEditorMouseOver = (e: Event) => {
        const target = e.target as HTMLElement;
        const link = target.closest('.autolink') || target.closest('a[href]');

        if (link) {
            this.clearHideTimer();
            if (this.activeLink === link) return;
            this.startShowTimer(link as HTMLElement);
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

    startShowTimer(link: HTMLElement) {
        this.clearShowTimer();
        this.showTimer = window.setTimeout(() => {
            this.show(link);
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

        dispatch(tr);

        if (shouldClose) {
            this.hide();
            return;
        }

        // Don't hide! Find the new link and keep showing it.
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
                onClose={() => this.hide()}
            />
        );

        this.dom.classList.remove('hidden');
        this.updatePosition(link);
        requestAnimationFrame(() => this.updatePosition(link));
    }

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

    update(_view: EditorView) {
        // Check if active link is still valid and in the document
        if (this.activeLink && !document.contains(this.activeLink)) {
            this.hide();
        }
    }

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

        dispatch(tr);

        if (shouldClose) {
            this.hide();
            return;
        }

        // Try to find and show the new link
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
    };

    destroy() {
        this.view.dom.removeEventListener('mouseover', this.handleEditorMouseOver);
        this.view.dom.removeEventListener('mouseout', this.handleEditorMouseOut);
        this.view.dom.removeEventListener('mousedown', this.handleEditorMouseDown, true);
        this.dom.removeEventListener('mouseenter', this.handleTooltipMouseEnter);
        this.dom.removeEventListener('mouseleave', this.handleTooltipMouseLeave);
        window.removeEventListener('scroll', this.handleScroll, true);
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
                update(view) {
                    tooltipView.update(view);

                    const pluginState = linkTooltipPluginKey.getState(view.state);

                    // Only process if shouldShow is true AND not already handled
                    if (pluginState?.shouldShow && !pluginState.handled) {

                        // Mark as handled immediately to prevent duplicate calls
                        // We do this by dispatching a transaction that marks it handled
                        const { from, to } = pluginState;

                        // Use setTimeout to let any pending DOM updates complete
                        setTimeout(() => {
                            tooltipView.showAtPosition(from, to);
                            // Clear the state after showing
                            view.dispatch(view.state.tr.setMeta(linkTooltipPluginKey, { type: 'CLEAR_LINK_TOOLTIP' }));
                        }, 50);

                        // Temporarily mark as handled to prevent re-triggering during the timeout
                        // This is a workaround since we can't mutate plugin state directly
                        (pluginState as { handled: boolean }).handled = true;
                    }
                },
                destroy() {
                    tooltipView.destroy();
                },
            };
        },
    });
});
