import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import React from 'react';
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
        this.dom.addEventListener('mouseenter', this.handleTooltipMouseEnter);
        this.dom.addEventListener('mouseleave', this.handleTooltipMouseLeave);
    }

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
                onClose={() => this.hide(true)}
            />
        );

        this.dom.classList.remove('hidden');
        this.updatePosition(link);
        requestAnimationFrame(() => this.updatePosition(link));
    }

    hide(immediate = false) {
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
        this.dom.removeEventListener('mouseenter', this.handleTooltipMouseEnter);
        this.dom.removeEventListener('mouseleave', this.handleTooltipMouseLeave);
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
