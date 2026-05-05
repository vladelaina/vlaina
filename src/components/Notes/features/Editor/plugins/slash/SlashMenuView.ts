import type { Ctx } from '@milkdown/kit/ctx';
import type { EditorView } from '@milkdown/kit/prose/view';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SlashMenuPanel } from './SlashMenuPanel';
import { applySlashCommand } from './slashCommands';
import { slashMenuItems } from './slashItems';
import { slashPluginKey } from './slashPluginKey';
import { filterSlashItems } from './slashQuery';
import { createSlashState, getSlashMenuPosition, getSlashTextRange } from './slashState';
import { getContentLayoutContext } from '../floating-toolbar/floatingToolbarLayout';
import { getScrollRoot, getToolbarRoot, toContainerPosition } from '../floating-toolbar/floatingToolbarDom';

const SLASH_MENU_MARGIN_PX = 12;
const SLASH_MENU_MAX_HEIGHT_PX = 360;
const SLASH_MENU_MIN_HEIGHT_PX = 160;

export class SlashMenuView {
  private menuElement: HTMLElement | null = null;
  private root: Root | null = null;
  private filtered = [...slashMenuItems];
  private readonly scrollRoot: HTMLElement | null;
  private readonly positionRoot: HTMLElement | null;
  private readonly resizeObserver: ResizeObserver | null;
  private layoutRaf = 0;
  private selectedScrollRaf = 0;
  private skipNextSelectedScroll = false;

  constructor(
    private readonly editorView: EditorView,
    private readonly ctx: Ctx
  ) {
    this.scrollRoot = getScrollRoot(editorView);
    this.positionRoot = getToolbarRoot(editorView) ?? this.scrollRoot;
    this.resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          this.scheduleViewportChange();
        });

    window.addEventListener('resize', this.handleViewportChange);
    this.scrollRoot?.addEventListener('scroll', this.handleViewportChange, { passive: true });
    document.addEventListener('mousedown', this.handleDocumentMouseDown, true);
    document.addEventListener('keydown', this.handleDocumentKeyDown, true);
    this.resizeObserver?.observe(this.editorView.dom);
    if (this.scrollRoot) {
      this.resizeObserver?.observe(this.scrollRoot);
    }
    if (this.positionRoot && this.positionRoot !== this.scrollRoot) {
      this.resizeObserver?.observe(this.positionRoot);
    }
  }

  update() {
    const state = slashPluginKey.getState(this.editorView.state);
    if (!state?.isOpen) {
      this.destroyMenu();
      return;
    }

    this.filtered = filterSlashItems(state.query, slashMenuItems);
    if (this.filtered.length === 0) {
      this.destroyMenu();
      return;
    }

    this.ensureMenu();
    this.syncPosition();

    this.root?.render(
      React.createElement(SlashMenuPanel, {
        items: this.filtered,
        selectedIndex: state.selectedIndex,
        onHoverItem: this.handleHoverItem,
        onSelectItem: this.applySelectedItem.bind(this),
      })
    );

    this.scheduleViewportChange();
    if (this.skipNextSelectedScroll) {
      this.skipNextSelectedScroll = false;
    } else {
      this.scheduleSelectedItemScroll();
    }
  }

  destroy() {
    if (this.layoutRaf !== 0) {
      cancelAnimationFrame(this.layoutRaf);
      this.layoutRaf = 0;
    }
    if (this.selectedScrollRaf !== 0) {
      cancelAnimationFrame(this.selectedScrollRaf);
      this.selectedScrollRaf = 0;
    }
    window.removeEventListener('resize', this.handleViewportChange);
    this.scrollRoot?.removeEventListener('scroll', this.handleViewportChange);
    document.removeEventListener('mousedown', this.handleDocumentMouseDown, true);
    document.removeEventListener('keydown', this.handleDocumentKeyDown, true);
    this.resizeObserver?.disconnect();
    this.destroyMenu();
  }

  applySelectedItem(index: number) {
    if (index < 0 || index >= this.filtered.length) return;

    const slashRange = getSlashTextRange(this.editorView);
    if (!slashRange) return;

    this.editorView.dispatch(
      this.editorView.state.tr
        .delete(slashRange.deleteFrom, slashRange.deleteTo)
        .setMeta(slashPluginKey, createSlashState())
    );

    applySlashCommand(this.ctx, this.filtered[index].commandId);
    this.editorView.focus();
  }

  private ensureMenu() {
    if (this.menuElement) {
      return this.menuElement;
    }

    const menu = document.createElement('div');
    menu.className = 'slash-menu';
    menu.style.position = this.positionRoot ? 'absolute' : 'fixed';
    (this.positionRoot ?? document.body).appendChild(menu);
    this.root = createRoot(menu);
    this.menuElement = menu;
    return menu;
  }

  private destroyMenu() {
    this.root?.unmount();
    this.root = null;

    if (!this.menuElement) return;
    this.menuElement.remove();
    this.menuElement = null;
  }

  private syncPosition() {
    if (!this.menuElement) return;

    const viewportPosition = getSlashMenuPosition(this.editorView);
    const containerPosition = toContainerPosition(viewportPosition, this.positionRoot);
    const layout = getContentLayoutContext(this.editorView, this.positionRoot);
    const menuWidth = this.menuElement.offsetWidth || 320;
    const menuHeight = this.menuElement.offsetHeight || SLASH_MENU_MAX_HEIGHT_PX;
    const horizontalBounds = this.positionRoot
      ? {
          left: layout.containerBounds?.left ?? SLASH_MENU_MARGIN_PX,
          right: layout.containerBounds?.right ?? this.positionRoot.clientWidth,
        }
      : {
          left: layout.viewportBounds.left,
          right: layout.viewportBounds.right,
        };
    const minX = horizontalBounds.left + SLASH_MENU_MARGIN_PX;
    const maxX = horizontalBounds.right - SLASH_MENU_MARGIN_PX - menuWidth;
    const nextX = maxX < minX
      ? minX
      : Math.max(minX, Math.min(containerPosition.x, maxX));
    const availableBelow = this.positionRoot
      ? this.positionRoot.clientHeight - containerPosition.y - 24
      : window.innerHeight - viewportPosition.y - 24;
    const availableAbove = containerPosition.y - 24;
    const shouldPlaceAbove =
      availableBelow < Math.min(menuHeight, 220) &&
      availableAbove > availableBelow;
    const nextY = shouldPlaceAbove
      ? Math.max(24, containerPosition.y - menuHeight - 8)
      : containerPosition.y;
    const availableHeight = shouldPlaceAbove ? availableAbove : availableBelow;

    this.menuElement.style.left = `${Math.round(nextX)}px`;
    this.menuElement.style.top = `${Math.round(nextY)}px`;
    this.menuElement.style.maxHeight = `${Math.max(
      SLASH_MENU_MIN_HEIGHT_PX,
      Math.min(SLASH_MENU_MAX_HEIGHT_PX, availableHeight),
    )}px`;
  }

  private scheduleViewportChange() {
    if (this.layoutRaf !== 0) {
      return;
    }

    this.layoutRaf = requestAnimationFrame(() => {
      this.layoutRaf = 0;
      if (!slashPluginKey.getState(this.editorView.state)?.isOpen) {
        return;
      }
      this.syncPosition();
    });
  }

  private scheduleSelectedItemScroll() {
    if (this.selectedScrollRaf !== 0) {
      return;
    }

    this.selectedScrollRaf = requestAnimationFrame(() => {
      this.selectedScrollRaf = 0;
      this.keepSelectedItemVisible();
    });
  }

  private keepSelectedItemVisible() {
    if (!this.menuElement) return;

    const selectedItem = this.menuElement.querySelector<HTMLElement>('.slash-menu-item.selected');
    if (!selectedItem) return;

    const itemTop = selectedItem.offsetTop;
    const itemBottom = itemTop + selectedItem.offsetHeight;
    const viewTop = this.menuElement.scrollTop;
    const viewBottom = viewTop + this.menuElement.clientHeight;

    if (itemTop < viewTop) {
      this.menuElement.scrollTop = itemTop;
      return;
    }

    if (itemBottom > viewBottom) {
      this.menuElement.scrollTop = itemBottom - this.menuElement.clientHeight;
    }
  }

  private handleViewportChange = () => {
    this.scheduleViewportChange();
  };

  private handleDocumentMouseDown = (event: MouseEvent) => {
    if (!slashPluginKey.getState(this.editorView.state)?.isOpen) return;

    const target = event.target;
    if (!(target instanceof Node)) return;
    if (this.menuElement?.contains(target)) return;

    this.editorView.dispatch(this.editorView.state.tr.setMeta(slashPluginKey, createSlashState()));
  };

  private handleDocumentKeyDown = (event: KeyboardEvent) => {
    const state = slashPluginKey.getState(this.editorView.state);
    if (!state?.isOpen || event.isComposing) return;

    const filtered = filterSlashItems(state.query, slashMenuItems);
    if (filtered.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        this.editorView.dispatch(
          this.editorView.state.tr.setMeta(slashPluginKey, {
            selectedIndex: (state.selectedIndex + 1) % filtered.length,
          })
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        this.editorView.dispatch(
          this.editorView.state.tr.setMeta(slashPluginKey, {
            selectedIndex: (state.selectedIndex - 1 + filtered.length) % filtered.length,
          })
        );
        break;

      case 'Enter':
      case 'Tab':
        event.preventDefault();
        event.stopPropagation();
        this.applySelectedItem(state.selectedIndex);
        break;

      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.editorView.dispatch(this.editorView.state.tr.setMeta(slashPluginKey, createSlashState()));
        break;
    }
  };

  private handleHoverItem = (index: number) => {
    const state = slashPluginKey.getState(this.editorView.state);
    if (!state?.isOpen || state.selectedIndex === index) return;

    this.skipNextSelectedScroll = true;
    this.editorView.dispatch(this.editorView.state.tr.setMeta(slashPluginKey, { selectedIndex: index }));
  };
}
