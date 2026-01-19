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

    handleEdit = (link: HTMLElement, text: string, url: string) => {
        const pos = this.view.posAtDOM(link, 0);
        if (pos < 0) return;

        const { state, dispatch } = this.view;
        const $pos = state.doc.resolve(pos);
        const linkMarkType = state.schema.marks.link;
        if (!linkMarkType) return;

        let absoluteStart = pos;
        let absoluteEnd = pos;

        // Check if we are editing a real Mark or an Autolink decoration
        const hasMark = linkMarkType.isInSet($pos.marks()) ||
            ($pos.nodeAfter && linkMarkType.isInSet($pos.nodeAfter.marks));

        if (hasMark) {
            // It's a Markdown Link [text](url) - Find the full mark range
            // We scan forward from the position until the mark disappears
            let scanForwards = pos;
            while (scanForwards < state.doc.content.size) {
                const $scan = state.doc.resolve(scanForwards);
                const marks = $scan.marks().concat($scan.nodeAfter?.marks || []);
                if (!linkMarkType.isInSet(marks)) {
                    break;
                }
                scanForwards++;
            }
            // We scan backward just in case pos was in the middle (though usually it's at start)
            let scanBackwards = pos;
            while (scanBackwards > 0) {
                const $scan = state.doc.resolve(scanBackwards);
                // Check marks before position
                const marks = $scan.marks(); // marks at position (left of cursor)
                // Note: $scan.marks() gets marks *at* path.
                // To check strictly before: 
                const marksBefore = state.doc.resolve(scanBackwards - 1).marks();
                if (!linkMarkType.isInSet(marksBefore)) {
                    break;
                }
                scanBackwards--;
            }

            absoluteStart = scanBackwards;
            absoluteEnd = scanForwards;
        } else {
            // It's an Autolink (Decoration) - No mark exists
            // The link element text is the range we want to replace
            const length = link.textContent?.length || 0;
            absoluteStart = pos;
            absoluteEnd = pos + length;
        }

        // Safety check to avoid zero-width replacement (duplication) if something goes wrong
        if (absoluteStart === absoluteEnd) {
            const length = link.textContent?.length || 0;
            absoluteEnd = absoluteStart + length;
        }

        // Dispatch transaction to update:
        // 1. Remove old link mark (if any)
        // 2. Replace text
        // 3. Add new link mark
        let tr = state.tr;

        if (hasMark) {
            tr = tr.removeMark(absoluteStart, absoluteEnd, linkMarkType);
        }

        tr = tr
            .insertText(text, absoluteStart, absoluteEnd)
            .addMark(absoluteStart, absoluteStart + text.length, linkMarkType.create({ href: url }));

        dispatch(tr);

        // Hide tooltip after edit
        this.hide();
    };

    show(link: HTMLElement) {
        if (this.activeLink && this.activeLink !== link) {
            this.activeLink.classList.remove('link-active-state');
        }

        this.activeLink = link;
        link.classList.add('link-active-state');

        const href = link.getAttribute('href') || link.getAttribute('data-href');
        if (!href) return;

        this.root?.render(
            <LinkTooltip
                key={Date.now()}
                href={href}
                initialText={link.textContent || ''}
                onEdit={(text, url) => this.handleEdit(link, text, url)}
                onClose={() => this.hide()}
            />
        );

        this.dom.classList.remove('hidden');
        this.updatePosition(link);
        requestAnimationFrame(() => this.updatePosition(link));
    }

    hide() {
        if (this.dom.hasAttribute('data-dropdown-open')) {
            return;
        }

        if (this.activeLink) {
            this.activeLink.classList.remove('link-active-state');
        }

        this.dom.classList.add('hidden');
        this.activeLink = null;
    }

    update(view: EditorView) {
        // Check if active link is still valid and in the document
        // This handles cases where the link is deleted or reformatted (nuclear option)
        if (this.activeLink && !document.contains(this.activeLink)) {
            this.hide();
        }
    }

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
        view: (editorView) => new LinkTooltipView(editorView)
    });
});
