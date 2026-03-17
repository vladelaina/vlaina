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

export class SlashMenuView {
  private menuElement: HTMLElement | null = null;
  private root: Root | null = null;
  private filtered = [...slashMenuItems];

  constructor(
    private readonly editorView: EditorView,
    private readonly ctx: Ctx
  ) {
    window.addEventListener('resize', this.handleViewportChange);
    window.addEventListener('scroll', this.handleViewportChange, true);
    document.addEventListener('mousedown', this.handleDocumentMouseDown, true);
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

    this.keepSelectedItemVisible();
  }

  destroy() {
    window.removeEventListener('resize', this.handleViewportChange);
    window.removeEventListener('scroll', this.handleViewportChange, true);
    document.removeEventListener('mousedown', this.handleDocumentMouseDown, true);
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
    document.body.appendChild(menu);
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

    const position = getSlashMenuPosition(this.editorView);
    this.menuElement.style.left = `${position.x}px`;
    this.menuElement.style.top = `${position.y}px`;
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
    if (!slashPluginKey.getState(this.editorView.state)?.isOpen) return;
    this.syncPosition();
  };

  private handleDocumentMouseDown = (event: MouseEvent) => {
    if (!slashPluginKey.getState(this.editorView.state)?.isOpen) return;

    const target = event.target;
    if (!(target instanceof Node)) return;
    if (this.menuElement?.contains(target)) return;

    this.editorView.dispatch(this.editorView.state.tr.setMeta(slashPluginKey, createSlashState()));
  };

  private handleHoverItem = (index: number) => {
    const state = slashPluginKey.getState(this.editorView.state);
    if (!state?.isOpen || state.selectedIndex === index) return;

    this.editorView.dispatch(this.editorView.state.tr.setMeta(slashPluginKey, { selectedIndex: index }));
  };
}
