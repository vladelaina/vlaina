import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { UniversalIconPicker } from '@/components/common/UniversalIconPicker';
import { notifyNotesOverlayOpen, onNotesOverlayOpen } from '@/components/Notes/features/overlays/notesOverlayEvents';
import { getContentLayoutContext } from '../floating-toolbar/floatingToolbarLayout';
import { getScrollRoot, getToolbarRoot, toContainerPosition } from '../floating-toolbar/floatingToolbarDom';
import {
  EMPTY_SLASH_EMOJI_PREVIEW_STATE,
  slashEmojiPreviewPluginKey,
  shouldUpdateSlashEmojiPreview,
  type SlashEmojiPreviewState,
} from './slashEmojiPreview';

const SLASH_EMOJI_PICKER_MARGIN_PX = 12;

function markSlashEmojiUserInput(view: EditorView): void {
  view.dom.dispatchEvent(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

export class SlashEmojiPickerSession {
  private menuElement: HTMLElement | null = null;
  private root: Root | null = null;
  private readonly scrollRoot: HTMLElement | null;
  private readonly positionRoot: HTMLElement | null;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly anchorPosition: { x: number; y: number };
  private readonly anchorSelection: { from: number; to: number };
  private layoutRaf = 0;
  private disposed = false;
  private readonly unlistenOverlayOpen: () => void;

  constructor(
    private readonly editorView: EditorView,
    private readonly onDestroy: (session: SlashEmojiPickerSession) => void,
  ) {
    this.scrollRoot = getScrollRoot(editorView);
    this.positionRoot = getToolbarRoot(editorView) ?? this.scrollRoot;
    this.anchorPosition = this.getAnchorPosition();
    this.anchorSelection = {
      from: editorView.state.selection.from,
      to: editorView.state.selection.to,
    };
    this.resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          this.schedulePositionSync();
        });
    this.unlistenOverlayOpen = onNotesOverlayOpen(({ source }) => {
      if (source === 'slash-emoji-picker') return;
      this.destroy();
    });

    window.addEventListener('resize', this.handleViewportChange);
    this.scrollRoot?.addEventListener('scroll', this.handleViewportChange, { passive: true });
    document.addEventListener('pointerdown', this.handleDocumentPointerDown, true);
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

  open() {
    notifyNotesOverlayOpen('slash-emoji-picker');
    this.ensureMenu();
    flushSync(() => {
      this.root?.render(
        React.createElement(UniversalIconPicker, {
          onSelect: this.insertSelectedEmoji,
          onPreview: this.updatePreview,
          onClose: this.closeAndFocusEditor,
          embedded: true,
          emojiOnly: true,
          surface: true,
          alwaysShowEmojiCategories: true,
        })
      );
    });
    this.syncPosition();
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearPreview();
    if (this.layoutRaf !== 0) {
      cancelAnimationFrame(this.layoutRaf);
      this.layoutRaf = 0;
    }
    window.removeEventListener('resize', this.handleViewportChange);
    this.scrollRoot?.removeEventListener('scroll', this.handleViewportChange);
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown, true);
    document.removeEventListener('mousedown', this.handleDocumentMouseDown, true);
    document.removeEventListener('keydown', this.handleDocumentKeyDown, true);
    this.unlistenOverlayOpen();
    this.resizeObserver?.disconnect();
    const root = this.root;
    this.root = null;
    if (root) {
      window.setTimeout(() => root.unmount(), 0);
    }
    this.menuElement?.remove();
    this.menuElement = null;
    this.onDestroy(this);
  }

  handleEditorUpdate(view: EditorView, previousState: EditorState | undefined) {
    if (this.disposed || view !== this.editorView) return;

    const { selection } = view.state;
    const movedAwayFromAnchor =
      selection.from !== this.anchorSelection.from ||
      selection.to !== this.anchorSelection.to;
    if (movedAwayFromAnchor || (previousState && !view.state.doc.eq(previousState.doc))) {
      this.destroy();
    }
  }

  private insertSelectedEmoji = (emoji: string) => {
    this.clearPreview();
    markSlashEmojiUserInput(this.editorView);
    this.editorView.dispatch(this.editorView.state.tr.insertText(emoji));
    this.destroy();
    this.editorView.focus();
  };

  private closeAndFocusEditor = () => {
    this.clearPreview();
    this.destroy();
    this.editorView.focus();
  };

  private ensureMenu() {
    if (this.menuElement) return this.menuElement;

    const menu = document.createElement('div');
    menu.className = 'slash-emoji-picker';
    menu.setAttribute('data-no-editor-drag-box', 'true');
    menu.style.position = this.positionRoot ? 'absolute' : 'fixed';
    menu.style.zIndex = 'var(--vlaina-z-modal-max)';
    (this.positionRoot ?? document.body).appendChild(menu);
    this.root = createRoot(menu);
    this.menuElement = menu;
    return menu;
  }

  private updatePreview = (emoji: string | null) => {
    if (!emoji) {
      this.clearPreview();
      return;
    }

    const pos = this.editorView.state.selection.from;
    const current = slashEmojiPreviewPluginKey.getState(this.editorView.state);
    if (!shouldUpdateSlashEmojiPreview(current, emoji, pos)) {
      return;
    }

    this.editorView.dispatch(
      this.editorView.state.tr.setMeta(slashEmojiPreviewPluginKey, {
        emoji,
        pos,
      } satisfies SlashEmojiPreviewState)
    );
  };

  private clearPreview() {
    const current = slashEmojiPreviewPluginKey.getState(this.editorView.state);
    if (!current?.emoji) return;
    this.editorView.dispatch(
      this.editorView.state.tr.setMeta(slashEmojiPreviewPluginKey, EMPTY_SLASH_EMOJI_PREVIEW_STATE)
    );
  }

  private syncPosition() {
    if (!this.menuElement) return;

    const position = this.anchorPosition;
    const containerPosition = toContainerPosition(position, this.positionRoot);
    const layout = getContentLayoutContext(this.editorView, this.positionRoot);
    const menuWidth = this.menuElement.offsetWidth || 352;
    const menuHeight = this.menuElement.offsetHeight || 420;
    const horizontalBounds = this.positionRoot
      ? {
          left: layout.containerBounds?.left ?? SLASH_EMOJI_PICKER_MARGIN_PX,
          right: layout.containerBounds?.right ?? this.positionRoot.clientWidth,
        }
      : {
          left: layout.viewportBounds.left,
          right: layout.viewportBounds.right,
        };
    const minX = horizontalBounds.left + SLASH_EMOJI_PICKER_MARGIN_PX;
    const maxX = horizontalBounds.right - SLASH_EMOJI_PICKER_MARGIN_PX - menuWidth;
    const nextX = maxX < minX
      ? minX
      : Math.max(minX, Math.min(containerPosition.x, maxX));
    const availableBelow = this.positionRoot
      ? this.positionRoot.clientHeight - containerPosition.y - 24
      : window.innerHeight - position.y - 24;
    const availableAbove = containerPosition.y - 24;
    const shouldPlaceAbove =
      availableBelow < Math.min(menuHeight, 260) &&
      availableAbove > availableBelow;
    const nextY = shouldPlaceAbove
      ? Math.max(24, containerPosition.y - menuHeight - 8)
      : containerPosition.y;

    this.menuElement.style.left = `${Math.round(nextX)}px`;
    this.menuElement.style.top = `${Math.round(nextY)}px`;
  }

  private getAnchorPosition() {
    try {
      const rect = this.editorView.coordsAtPos(this.editorView.state.selection.from);
      return {
        x: rect.left,
        y: rect.bottom + 8,
      };
    } catch {
      const rect = this.editorView.dom.getBoundingClientRect();
      return {
        x: rect.left + SLASH_EMOJI_PICKER_MARGIN_PX,
        y: rect.top + SLASH_EMOJI_PICKER_MARGIN_PX,
      };
    }
  }

  private schedulePositionSync() {
    if (this.layoutRaf !== 0) return;
    this.layoutRaf = requestAnimationFrame(() => {
      this.layoutRaf = 0;
      this.syncPosition();
    });
  }

  private handleViewportChange = () => {
    this.schedulePositionSync();
  };

  private handleDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target;
    if (target instanceof Node && this.menuElement?.contains(target)) return;
    this.destroy();
  };

  private handleDocumentMouseDown = (event: MouseEvent) => {
    const target = event.target;
    if (target instanceof Node && this.menuElement?.contains(target)) return;
    this.destroy();
  };

  private handleDocumentKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    const isInsideMenu = target instanceof Node && this.menuElement?.contains(target);

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeAndFocusEditor();
      return;
    }

    if (isInsideMenu || event.isComposing) return;
    if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta') {
      return;
    }

    this.destroy();
  };
}
