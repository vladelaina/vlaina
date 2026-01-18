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

        // Find the range of the link mark
        const { parent, parentOffset } = $pos;
        let start = parentOffset;
        let end = parentOffset;

        // Find the mark type for 'link'
        const linkMarkType = state.schema.marks.link;
        if (!linkMarkType) return;

        // Search backwards for mark start
        while (start > 0 && linkMarkType.isInSet(parent.child(start - 1).marks)) {
            start--;
        }

        // Search forwards for mark end
        while (end < parent.childCount && linkMarkType.isInSet(parent.child(end).marks)) {
            end++;
        }

        const absoluteStart = $pos.start() + start;
        const absoluteEnd = $pos.start() + end;

        // Dispatch transaction to update:
        // 1. Remove old link mark
        // 2. Replace text
        // 3. Add new link mark
        const tr = state.tr
            .removeMark(absoluteStart, absoluteEnd, linkMarkType)
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
