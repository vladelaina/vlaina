import type { EditorView } from '@milkdown/kit/prose/view';
import { Fragment } from '@milkdown/kit/prose/model';
import { Selection } from '@milkdown/kit/prose/state';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/useNotesStore';
import { savePendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdown';
import { getBlockSelectionPluginState } from './blockSelectionPluginState';
import { getBlockRangesKey, normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import { pickPointerBlock } from './blockControlsUtils';
import {
  createBlockDragPreview,
  createBlockDragSourceMarker,
  type BlockDragPreviewHandle,
  type BlockDragSourceMarkerHandle,
} from './blockDragPreview';
import { createBlockControlsDom } from './blockControlsDom';
import { setBlockDraggingVisualState } from './blockDragVisualState';
import { getListItemRangeEnd } from './blockUnitResolver';
import { buildDeleteRangesForBlockSelection } from './listBlockUtils';
import { normalizeSelectedTextForComposer } from '@/lib/ui/normalizeSelectedTextForComposer';
import {
  MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS,
  canInsertTextIntoComposerValue,
} from '@/lib/ui/composerFocusRegistry';
import { serializeSelectedBlocksToText } from './blockSelectionSerializer';
import { getCurrentMarkdownParser, getCurrentMarkdownSerializer } from '../../utils/editorViewRegistry';
import { serializeEditorMarkdownSnapshot } from '../../utils/pendingMarkdownUpdate';
import { markEditorUserInput } from '../shared/userInputEvents';
import {
  getCurrentEditorBlockPositionSnapshot,
  subscribeCurrentEditorBlockPositionSnapshot,
  type EditorBlockPositionSnapshot,
} from '../../utils/editorBlockPositionCache';
import {
  applyBlockMove,
  canApplyBlockMove,
  getDraggableBlockRanges,
  getHandleBlockTargets,
  resolveBlockTargetByPos,
  resolveDropTarget,
  setControlsPosition,
  type DropTarget,
  type HandleBlockTarget,
} from './blockControlsInteractions';
import { BLOCK_CONTROLS_LEFT_OFFSET_PX } from './blockControlsGeometry';
import { createVerticalEdgeAutoScroll, type VerticalEdgeAutoScrollHandle } from './edgeAutoScroll';

const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const MIN_DROP_DISTANCE_PX = 4;
const HANDLE_VERTICAL_GAP_PX = 24;
const WHEEL_DELTA_MODE_LINE = 1;
const WHEEL_DELTA_MODE_PAGE = 2;
const WHEEL_LINE_HEIGHT_PX = 16;
const NOTES_BLOCK_DROP_TARGET_SELECTOR = '[data-notes-block-drop-target="true"]';
const NOTES_TAB_PATH_SELECTOR = '[data-notes-tab-path]';
const BLOCK_DRAG_TAB_OPEN_DELAY_MS = 280;
const BLOCK_SELECTION_PENDING_CLASS = 'editor-block-selection-pending';
const LIST_CONTAINER_NODE_NAMES = new Set(['bullet_list', 'ordered_list']);

function normalizeWheelDelta(delta: number, deltaMode: number, pageSize: number): number {
  if (deltaMode === WHEEL_DELTA_MODE_LINE) return delta * WHEEL_LINE_HEIGHT_PX;
  if (deltaMode === WHEEL_DELTA_MODE_PAGE) return delta * pageSize;
  return delta;
}

function serializeDraggedRangesForComposer(view: EditorView, ranges: BlockRange[]): string {
  if (ranges.some((range) => range.to - range.from > MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS)) {
    return '';
  }

  const text = normalizeSelectedTextForComposer(
    serializeSelectedBlocksToText(view.state, ranges, {
      markdownSerializer: getCurrentMarkdownSerializer(),
    })
  );
  return canInsertTextIntoComposerValue('', text) ? text : '';
}

function serializeDraggedRangesForMarkdown(view: EditorView, ranges: BlockRange[]): string {
  if (ranges.some((range) => range.to - range.from > MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS)) {
    return '';
  }

  return serializeSelectedBlocksToText(view.state, ranges, {
    markdownSerializer: getCurrentMarkdownSerializer(),
  }).trim();
}

function getCurrentNotePath(): string | null {
  return useNotesStore.getState().currentNote?.path ?? null;
}

function getReferenceMarkdownForNotePath(notePath: string | null): string {
  if (!notePath) return '';
  const state = useNotesStore.getState();
  if (state.currentNote?.path === notePath) {
    return state.currentNote.content;
  }
  return state.noteContentsCache.get(notePath)?.content ?? '';
}

function openNotePath(path: string): Promise<void> {
  const state = useNotesStore.getState();
  return isAbsolutePath(path)
    ? state.openNoteByAbsolutePath(path)
    : state.openNote(path);
}

function serializeSourceMarkdownAfterDelete(
  view: EditorView,
  ranges: readonly BlockRange[],
  sourceNotePath: string | null,
): string | null {
  const serializer = getCurrentMarkdownSerializer();
  if (!serializer || !sourceNotePath) return null;

  const normalized = normalizeBlockRanges(ranges);
  const deleteRanges = buildDeleteRangesForBlockSelection(view.state, normalized);
  if (deleteRanges.length === 0) return null;

  try {
    let tr = view.state.tr;
    for (let index = deleteRanges.length - 1; index >= 0; index -= 1) {
      const range = deleteRanges[index];
      tr = tr.delete(range.from, range.to);
    }

    if (tr.doc.content.size === 0) {
      const paragraphType = tr.doc.type.schema.nodes.paragraph;
      if (paragraphType) {
        tr = tr.insert(0, paragraphType.create());
      }
    }

    return serializeEditorMarkdownSnapshot(
      serializer(tr.doc),
      getReferenceMarkdownForNotePath(sourceNotePath),
    );
  } catch {
    return null;
  }
}

function serializeCurrentMarkdownForNotePath(view: EditorView, notePath: string | null): string | null {
  const serializer = getCurrentMarkdownSerializer();
  if (!serializer || !notePath) return null;

  try {
    return serializeEditorMarkdownSnapshot(
      serializer(view.state.doc),
      getReferenceMarkdownForNotePath(notePath),
    );
  } catch {
    return null;
  }
}

function parseDraggedMarkdown(markdown: string | null): Fragment | null {
  if (!markdown?.trim()) return null;
  const parser = getCurrentMarkdownParser();
  if (!parser) return null;

  try {
    const doc = parser(markdown) as ProseNode | null;
    return doc?.content ? (doc.content as Fragment) : null;
  } catch {
    return null;
  }
}

function unwrapListFragmentForTarget(fragment: Fragment, parentTypeName: string): Fragment | null {
  if (!LIST_CONTAINER_NODE_NAMES.has(parentTypeName) || fragment.childCount !== 1) {
    return null;
  }

  const child = fragment.child(0);
  return child.type.name === parentTypeName ? (child.content as Fragment) : null;
}

function resolveCrossNoteInsertContent(view: EditorView, markdown: string | null, insertPos: number): {
  content: Fragment;
  insertPos: number;
} | null {
  const fragment = parseDraggedMarkdown(markdown);
  if (!fragment || fragment.size === 0) return null;

  try {
    const safePos = Math.max(0, Math.min(insertPos, view.state.doc.content.size));
    const $target = view.state.doc.resolve(safePos);
    const targetIndex = $target.index();
    const unwrappedListContent = unwrapListFragmentForTarget(fragment, $target.parent.type.name);
    const candidates = unwrappedListContent ? [unwrappedListContent, fragment] : [fragment];

    for (const content of candidates) {
      if (content.size === 0) continue;
      if ($target.parent.canReplace(targetIndex, targetIndex, content)) {
        return { content, insertPos: safePos };
      }
    }
  } catch {
  }

  return null;
}

function canInsertCrossNoteDraggedMarkdown(view: EditorView, markdown: string | null, insertPos: number): boolean {
  return (
    getCurrentMarkdownSerializer() !== null &&
    resolveCrossNoteInsertContent(view, markdown, insertPos) !== null
  );
}

function insertCrossNoteDraggedMarkdown(
  view: EditorView,
  markdown: string | null,
  insertPos: number,
  targetNotePath: string | null,
): string | null {
  if (!getCurrentMarkdownSerializer() || !targetNotePath) return null;
  const target = resolveCrossNoteInsertContent(view, markdown, insertPos);
  if (!target) return null;

  try {
    let tr = view.state.tr.insert(target.insertPos, target.content);
    const selectionAnchor = Math.max(0, Math.min(target.insertPos + target.content.size, tr.doc.content.size));
    tr = tr.setSelection(Selection.near(tr.doc.resolve(selectionAnchor), -1)).scrollIntoView();
    markEditorUserInput(view);
    view.dispatch(tr);
    view.focus();
    return serializeCurrentMarkdownForNotePath(view, targetNotePath);
  } catch {
    return null;
  }
}

function isOverNotesBlockDropTarget(doc: Document, clientX: number, clientY: number): boolean {
  const elements = typeof doc.elementsFromPoint === 'function'
    ? doc.elementsFromPoint(clientX, clientY)
    : [];
  return elements.some((element) => element.closest(NOTES_BLOCK_DROP_TARGET_SELECTOR));
}

function getNotesTabPathFromPoint(doc: Document, clientX: number, clientY: number): string | null {
  if (typeof doc.elementsFromPoint !== 'function') return null;

  for (const element of doc.elementsFromPoint(clientX, clientY)) {
    const tab = element.closest(NOTES_TAB_PATH_SELECTOR) as HTMLElement | null;
    const path = tab?.dataset.notesTabPath;
    if (path) return path;
  }

  return null;
}

type PendingCrossNoteBlockDrag = {
  sourceNotePath: string | null;
  draggedMarkdown: string | null;
  sourceMarkdownAfterDelete: string | null;
  dragStartClientX: number;
  dragStartClientY: number;
  lastClientX: number;
  lastClientY: number;
  preview: BlockDragPreviewHandle | null;
};

let pendingCrossNoteBlockDrag: PendingCrossNoteBlockDrag | null = null;

type SavePendingMarkdown = typeof savePendingEditorMarkdown;

async function saveCrossNoteBlockDropAfterTargetSave({
  sourceNotePath,
  sourceMarkdownAfterDelete,
  targetNotePath,
  targetMarkdownAfterInsert,
  saveMarkdown = savePendingEditorMarkdown,
}: {
  sourceNotePath: string;
  sourceMarkdownAfterDelete: string;
  targetNotePath: string;
  targetMarkdownAfterInsert: string;
  saveMarkdown?: SavePendingMarkdown;
}): Promise<boolean> {
  const targetSaved = await saveMarkdown(targetNotePath, targetMarkdownAfterInsert);
  if (!targetSaved) return false;

  return saveMarkdown(sourceNotePath, sourceMarkdownAfterDelete);
}

function setPendingCrossNoteBlockDrag(pending: PendingCrossNoteBlockDrag): void {
  pendingCrossNoteBlockDrag = pending;
}

function clearPendingCrossNoteBlockDrag(): void {
  pendingCrossNoteBlockDrag = null;
}

function updatePendingCrossNoteBlockDragPointer(clientX: number, clientY: number): void {
  if (!pendingCrossNoteBlockDrag) return;
  pendingCrossNoteBlockDrag.lastClientX = clientX;
  pendingCrossNoteBlockDrag.lastClientY = clientY;
}

function setPendingCrossNoteBlockDragPreview(preview: BlockDragPreviewHandle | null): void {
  if (!pendingCrossNoteBlockDrag) return;
  pendingCrossNoteBlockDrag.preview = preview;
}

export class BlockControlsViewSession {
  private readonly view: EditorView;
  private readonly doc: Document;
  private readonly scrollRoot: HTMLElement | null;
  private readonly controls: HTMLDivElement;
  private readonly handleButton: HTMLButtonElement;
  private readonly dropIndicator: HTMLDivElement;
  private readonly dragAutoScroll: VerticalEdgeAutoScrollHandle;

  private draggedRanges: BlockRange[] | null = null;
  private dragPreview: BlockDragPreviewHandle | null = null;
  private dragSourceMarker: BlockDragSourceMarkerHandle | null = null;
  private pendingDrop: DropTarget | null = null;
  private dragStartClientX: number | null = null;
  private dragStartClientY: number | null = null;
  private lastDragClientX: number | null = null;
  private lastDragClientY: number | null = null;
  private pendingDragClientX: number | null = null;
  private pendingDragClientY: number | null = null;
  private pointerX: number | null = null;
  private pointerY: number | null = null;
  private dragSourceDoc: EditorView['state']['doc'] | null = null;
  private dragSourceNotePath: string | null = null;
  private draggedMarkdown: string | null = null;
  private dragSourceMarkdownAfterDelete: string | null = null;
  private blockDragTabOpenPath: string | null = null;
  private blockDragTabOpenTimerId: number | null = null;
  private refreshRafId = 0;
  private dragPointerRafId = 0;

  private cachedTargets: HandleBlockTarget[] = [];
  private cachedSelectionKey = '';
  private cachedDoc;
  private cachedScrollLeft = Number.NaN;
  private cachedScrollTop = Number.NaN;
  private cachedSnapshotVersion = Number.NaN;
  private cachedSelectedBlocks: readonly BlockRange[] | null = null;
  private cachedNormalizedSelectedRanges: BlockRange[] = [];
  private cachedDraggableRanges: BlockRange[] = [];
  private cachedDraggableSelectionKey = '';
  private dragWheelListenerAttached = false;
  private readonly unsubscribeBlockPositionSnapshot: () => void;

  constructor(view: EditorView) {
    this.view = view;
    this.doc = view.dom.ownerDocument;
    this.scrollRoot = view.dom.closest(SCROLL_ROOT_SELECTOR) as HTMLElement | null;
    this.cachedDoc = view.state.doc;
    this.dragAutoScroll = createVerticalEdgeAutoScroll({
      scrollRoot: this.scrollRoot,
      getPointerY: () => this.draggedRanges ? this.lastDragClientY : null,
      onScroll: this.refreshDragDropAfterScroll,
    });

    const { controls, handleButton, dropIndicator } = createBlockControlsDom(this.doc);
    this.controls = controls;
    this.handleButton = handleButton;
    this.dropIndicator = dropIndicator;

    this.handleButton.addEventListener('mousedown', this.handleHandleMouseDown);
    this.doc.addEventListener('mousemove', this.handleDocumentMouseMove, true);
    this.doc.addEventListener('pointermove', this.handleDocumentPointerMove, true);
    this.doc.addEventListener('mouseup', this.handleDocumentMouseUp, true);
    this.doc.addEventListener('keydown', this.handleDocumentKeyDown, true);
    this.scrollRoot?.addEventListener('scroll', this.handleScrollOrResize, { passive: true });
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('resize', this.handleScrollOrResize);
    this.unsubscribeBlockPositionSnapshot = subscribeCurrentEditorBlockPositionSnapshot(
      this.handleBlockPositionSnapshot,
    );
    this.adoptPendingCrossNoteBlockDrag();
  }

  update(): void {
    if (this.isBlockSelectionPending()) {
      this.hideControls();
      return;
    }
    if (this.pointerY === null && !this.controls.classList.contains('visible') && !this.draggedRanges) {
      return;
    }
    if (this.cachedDoc !== this.view.state.doc) {
      this.invalidateSelectionCache();
    }
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  }

  private adoptPendingCrossNoteBlockDrag(): void {
    const pending = pendingCrossNoteBlockDrag;
    const currentNotePath = getCurrentNotePath();
    if (!pending || !currentNotePath || currentNotePath === pending.sourceNotePath) {
      return;
    }

    this.draggedRanges = [];
    this.dragStartClientX = pending.dragStartClientX;
    this.dragStartClientY = pending.dragStartClientY;
    this.lastDragClientX = pending.lastClientX;
    this.lastDragClientY = pending.lastClientY;
    this.dragSourceDoc = null;
    this.dragSourceNotePath = pending.sourceNotePath;
    this.draggedMarkdown = pending.draggedMarkdown;
    this.dragSourceMarkdownAfterDelete = pending.sourceMarkdownAfterDelete;
    this.dragPreview = pending.preview;
    this.setPointer(pending.lastClientX, pending.lastClientY);
    this.attachDragWheelListener();
    this.dragAutoScroll.start();
    this.controls.classList.add('dragging');
    setBlockDraggingVisualState(true);
    this.scheduleDragPointerUpdate(pending.lastClientX, pending.lastClientY);
  }

  private shouldPreserveCrossNoteDragOnDestroy(): boolean {
    const pending = pendingCrossNoteBlockDrag;
    const currentNotePath = getCurrentNotePath();
    return Boolean(
      this.draggedRanges
      && pending
      && currentNotePath
      && currentNotePath !== pending.sourceNotePath,
    );
  }

  destroy(): void {
    const preserveCrossNoteDrag = this.shouldPreserveCrossNoteDragOnDestroy();
    if (this.refreshRafId !== 0) {
      window.cancelAnimationFrame(this.refreshRafId);
      this.refreshRafId = 0;
    }
    if (this.dragPointerRafId !== 0) {
      window.cancelAnimationFrame(this.dragPointerRafId);
      this.dragPointerRafId = 0;
    }
    if (!preserveCrossNoteDrag) {
      if (this.draggedRanges) {
        clearPendingCrossNoteBlockDrag();
      }
      setBlockDraggingVisualState(false);
    }
    this.clearBlockDragTabOpen();
    this.handleButton.removeEventListener('mousedown', this.handleHandleMouseDown);
    this.doc.removeEventListener('mousemove', this.handleDocumentMouseMove, true);
    this.doc.removeEventListener('pointermove', this.handleDocumentPointerMove, true);
    this.doc.removeEventListener('mouseup', this.handleDocumentMouseUp, true);
    this.dragAutoScroll.stop();
    this.detachDragWheelListener();
    this.doc.removeEventListener('keydown', this.handleDocumentKeyDown, true);
    this.scrollRoot?.removeEventListener('scroll', this.handleScrollOrResize);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('resize', this.handleScrollOrResize);
    this.unsubscribeBlockPositionSnapshot();
    if (this.dragPreview) {
      if (!preserveCrossNoteDrag || pendingCrossNoteBlockDrag?.preview !== this.dragPreview) {
        this.dragPreview.destroy();
      }
      this.dragPreview = null;
    }
    if (this.dragSourceMarker) {
      this.dragSourceMarker.destroy();
      this.dragSourceMarker = null;
    }
    this.controls.remove();
    this.dropIndicator.remove();
  }

  private getDraggableSelection(): { ranges: BlockRange[]; key: string; selectedRanges: BlockRange[] } {
    const selectedBlocks = getBlockSelectionPluginState(this.view.state).selectedBlocks;
    if (this.cachedSelectedBlocks === selectedBlocks) {
      return {
        ranges: this.cachedDraggableRanges,
        key: this.cachedDraggableSelectionKey,
        selectedRanges: this.cachedNormalizedSelectedRanges,
      };
    }

    const selectedRanges = normalizeBlockRanges(selectedBlocks);
    const ranges = getDraggableBlockRanges(this.view, selectedRanges);
    const key = ranges.length > 0 ? getBlockRangesKey(ranges) : '';
    this.cachedSelectedBlocks = selectedBlocks;
    this.cachedNormalizedSelectedRanges = selectedRanges;
    this.cachedDraggableRanges = ranges;
    this.cachedDraggableSelectionKey = key;
    return { ranges, key, selectedRanges };
  }

  private isPointerInEditorScrollRoot(): boolean {
    if (this.pointerX === null || this.pointerY === null) return false;
    if (typeof this.doc.elementFromPoint === 'function') {
      const hoveredElement = this.doc.elementFromPoint(this.pointerX, this.pointerY);
      if (hoveredElement instanceof Node && this.controls.contains(hoveredElement)) {
        return true;
      }
    }
    if (!this.scrollRoot) return true;

    const rect = this.scrollRoot.getBoundingClientRect();
    return this.pointerX >= rect.left
      && this.pointerX <= rect.right
      && this.pointerY >= rect.top
      && this.pointerY <= rect.bottom;
  }

  private isBlockSelectionPending(): boolean {
    return this.view.dom.classList.contains(BLOCK_SELECTION_PENDING_CLASS);
  }

  private isPointerNearTarget(target: HandleBlockTarget): boolean {
    if (this.pointerY === null) return false;
    if (this.pointerY >= target.rect.top && this.pointerY <= target.rect.bottom) return true;

    const distance = this.pointerY < target.rect.top
      ? target.rect.top - this.pointerY
      : this.pointerY - target.rect.bottom;
    return distance <= HANDLE_VERTICAL_GAP_PX;
  }

  private hideControls(): void {
    this.controls.classList.remove('visible');
  }

  private clearPointer(): void {
    this.pointerX = null;
    this.pointerY = null;
  }

  private setPointer(clientX: number, clientY: number): void {
    this.pointerX = clientX;
    this.pointerY = clientY;
  }

  private hideDropIndicator(): void {
    this.pendingDrop = null;
    this.dropIndicator.classList.remove('visible');
  }

  private updateDropTargetByPointer(clientX: number, clientY: number): boolean {
    const target = resolveDropTarget(this.view, clientX, clientY);
    if (!target) {
      this.hideDropIndicator();
      return false;
    }
    if (!this.draggedRanges) {
      this.hideDropIndicator();
      return false;
    }
    if (this.isCrossNoteDrag()) {
      if (
        this.dragSourceMarkdownAfterDelete === null
        || !canInsertCrossNoteDraggedMarkdown(this.view, this.draggedMarkdown, target.insertPos)
      ) {
        this.hideDropIndicator();
        return false;
      }
    } else if (!canApplyBlockMove(this.view, this.draggedRanges, target.insertPos)) {
      this.hideDropIndicator();
      return false;
    }
    this.pendingDrop = target;
    this.dropIndicator.style.left = `${Math.round(target.lineLeft)}px`;
    this.dropIndicator.style.top = `${Math.round(target.lineY - 1)}px`;
    this.dropIndicator.style.width = `${Math.round(target.lineWidth)}px`;
    this.dropIndicator.classList.add('visible');
    return true;
  }

  private applyDragPointerUpdate(clientX: number, clientY: number): void {
    this.updateBlockDragTabHover(clientX, clientY);
    if (isOverNotesBlockDropTarget(this.doc, clientX, clientY)) {
      this.hideDropIndicator();
    } else {
      this.updateDropTargetByPointer(clientX, clientY);
    }
    if (this.dragPreview) {
      this.dragPreview.element.style.left = `${Math.round(clientX - this.dragPreview.offsetX)}px`;
      this.dragPreview.element.style.top = `${Math.round(clientY - this.dragPreview.offsetY)}px`;
    }
  }

  private scheduleDragPointerUpdate(clientX: number, clientY: number): void {
    this.pendingDragClientX = clientX;
    this.pendingDragClientY = clientY;
    if (this.dragPointerRafId !== 0) return;

    this.dragPointerRafId = window.requestAnimationFrame(() => {
      this.dragPointerRafId = 0;
      const nextX = this.pendingDragClientX;
      const nextY = this.pendingDragClientY;
      this.pendingDragClientX = null;
      this.pendingDragClientY = null;
      if (nextX === null || nextY === null || !this.draggedRanges) return;
      this.applyDragPointerUpdate(nextX, nextY);
    });
  }

  private flushDragPointerUpdate(): void {
    if (this.dragPointerRafId !== 0) {
      window.cancelAnimationFrame(this.dragPointerRafId);
      this.dragPointerRafId = 0;
    }
    const nextX = this.pendingDragClientX;
    const nextY = this.pendingDragClientY;
    this.pendingDragClientX = null;
    this.pendingDragClientY = null;
    if (nextX === null || nextY === null || !this.draggedRanges) return;
    this.applyDragPointerUpdate(nextX, nextY);
  }

  private invalidateTargetCache(): void {
    this.cachedTargets = [];
    this.cachedSelectionKey = '';
    this.cachedDoc = this.view.state.doc;
    this.cachedScrollLeft = Number.NaN;
    this.cachedScrollTop = Number.NaN;
    this.cachedSnapshotVersion = Number.NaN;
  }

  private invalidateSelectionCache(): void {
    this.cachedSelectedBlocks = null;
    this.cachedNormalizedSelectedRanges = [];
    this.cachedDraggableRanges = [];
    this.cachedDraggableSelectionKey = '';
  }

  private getCachedHandleTargets(): HandleBlockTarget[] {
    const {
      selectedRanges,
    } = this.getDraggableSelection();
    if (selectedRanges.length === 0) {
      return this.getSelectedDomHandleTargets();
    }
    const selectionKey = getBlockRangesKey(selectedRanges);
    const nextScrollLeft = this.scrollRoot?.scrollLeft ?? 0;
    const nextScrollTop = this.scrollRoot?.scrollTop ?? 0;
    const snapshot = getCurrentEditorBlockPositionSnapshot();
    const snapshotVersion = snapshot?.view === this.view ? snapshot.version : 0;
    if (
      this.cachedSelectionKey === selectionKey
      && this.cachedDoc === this.view.state.doc
      && this.cachedScrollLeft === nextScrollLeft
      && this.cachedScrollTop === nextScrollTop
      && this.cachedSnapshotVersion === snapshotVersion
    ) {
      return this.cachedTargets;
    }

    this.cachedSelectionKey = selectionKey;
    this.cachedDoc = this.view.state.doc;
    this.cachedScrollLeft = nextScrollLeft;
    this.cachedScrollTop = nextScrollTop;
    this.cachedSnapshotVersion = snapshotVersion;
    const stateTargets = getHandleBlockTargets(this.view, selectedRanges);
    this.cachedTargets = stateTargets.length > 0
      ? stateTargets
      : this.getSelectedDomHandleTargets();
    return this.cachedTargets;
  }

  private getSelectedDomHandleTargets(): HandleBlockTarget[] {
    return Array.from(this.view.dom.querySelectorAll<HTMLElement>('.editor-block-selected'))
      .map((element, index): HandleBlockTarget | null => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        let pos = -1 - index;
        try {
          pos = this.view.posAtDOM(element, 0);
        } catch {
        }
        return {
          pos,
          rect,
          isListItem: element.tagName === 'LI',
          element,
        };
      })
      .filter((target): target is HandleBlockTarget => target !== null)
      .sort((left, right) => (
        left.rect.height === right.rect.height
          ? left.rect.top - right.rect.top
          : left.rect.height - right.rect.height
      ));
  }

  private resolveDomHorizontalAnchor(target: HandleBlockTarget): HandleBlockTarget | null {
    const element = target.element;
    if (!element || element.tagName !== 'LI') return null;

    let anchor: HTMLElement | null = null;
    for (let current = element.parentElement?.closest('li.editor-block-selected') as HTMLElement | null;
      current && this.view.dom.contains(current);
      current = current.parentElement?.closest('li.editor-block-selected') as HTMLElement | null
    ) {
      if (!current.contains(element)) continue;
      if (!anchor || current.getBoundingClientRect().left < anchor.getBoundingClientRect().left) {
        anchor = current;
      }
    }

    if (!anchor) return null;
    const rect = anchor.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    let pos = target.pos;
    try {
      pos = this.view.posAtDOM(anchor, 0);
    } catch {
    }
    return {
      pos,
      rect,
      isListItem: true,
      element: anchor,
    };
  }

  private resolveGroupedListHorizontalAnchor(
    target: HandleBlockTarget,
    targets: readonly HandleBlockTarget[],
    draggableRanges: readonly BlockRange[],
  ): HandleBlockTarget {
    let anchor: HandleBlockTarget | null = null;

    for (const range of draggableRanges) {
      if (range.from === target.pos || range.from > target.pos) continue;
      const listItemTo = getListItemRangeEnd(this.view.state.doc, range.from);
      if (listItemTo === null || target.pos >= listItemTo) continue;

      const candidate = targets.find((item) => item.pos === range.from)
        ?? resolveBlockTargetByPos(this.view, range.from);
      if (!candidate) continue;
      if (!anchor || candidate.rect.left < anchor.rect.left || (
        candidate.rect.left === anchor.rect.left && candidate.pos < anchor.pos
      )) {
        anchor = candidate;
      }
    }

    return anchor ?? target;
  }

  private showHandleForPointer(): void {
    if (this.draggedRanges) return;
    if (this.isBlockSelectionPending()) {
      this.hideControls();
      return;
    }
    if (!this.isPointerInEditorScrollRoot()) {
      this.hideControls();
      return;
    }
    const { selectedRanges } = this.getDraggableSelection();
    const targets = this.getCachedHandleTargets();
    const nextTarget = pickPointerBlock(targets, this.pointerY);
    if (!nextTarget || !this.isPointerNearTarget(nextTarget)) {
      this.hideControls();
      return;
    }
    const horizontalAnchor = this.resolveGroupedListHorizontalAnchor(nextTarget, targets, selectedRanges);
    const domHorizontalAnchor = horizontalAnchor === nextTarget
      ? this.resolveDomHorizontalAnchor(nextTarget)
      : null;
    if (horizontalAnchor === nextTarget && !domHorizontalAnchor) {
      setControlsPosition(this.controls, nextTarget, BLOCK_CONTROLS_LEFT_OFFSET_PX);
    } else {
      setControlsPosition(this.controls, nextTarget, BLOCK_CONTROLS_LEFT_OFFSET_PX, {
        horizontalAnchor: domHorizontalAnchor ?? horizontalAnchor,
      });
    }
    this.controls.classList.add('visible');
  }

  private scheduleHandleRefresh(): void {
    if (!this.draggedRanges && this.isBlockSelectionPending()) {
      this.hideControls();
      return;
    }
    if (this.refreshRafId !== 0) return;
    this.refreshRafId = window.requestAnimationFrame(() => {
      this.refreshRafId = 0;
      this.showHandleForPointer();
    });
  }

  private attachDragWheelListener(): void {
    if (this.dragWheelListenerAttached) return;
    this.dragWheelListenerAttached = true;
    this.doc.addEventListener('wheel', this.handleDocumentWheel, { capture: true, passive: false });
  }

  private detachDragWheelListener(): void {
    if (!this.dragWheelListenerAttached) return;
    this.dragWheelListenerAttached = false;
    this.doc.removeEventListener('wheel', this.handleDocumentWheel, true);
  }

  private readonly refreshDragDropAfterScroll = (): void => {
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
    if (this.lastDragClientX !== null && this.lastDragClientY !== null) {
      this.scheduleDragPointerUpdate(this.lastDragClientX, this.lastDragClientY);
    } else {
      this.hideDropIndicator();
    }
  };

  private scheduleBlockDragTabOpen(path: string): void {
    if (!this.draggedRanges || path === getCurrentNotePath()) {
      this.clearBlockDragTabOpen();
      return;
    }
    if (this.blockDragTabOpenPath === path) {
      return;
    }

    this.clearBlockDragTabOpen();
    this.blockDragTabOpenPath = path;
    this.blockDragTabOpenTimerId = window.setTimeout(() => {
      this.blockDragTabOpenTimerId = null;
      if (!this.draggedRanges || this.blockDragTabOpenPath !== path) {
        return;
      }

      if (getCurrentNotePath() === path) {
        this.blockDragTabOpenPath = null;
        return;
      }

      void openNotePath(path)
        .catch(() => undefined)
        .finally(() => {
          if (this.blockDragTabOpenPath === path) {
            this.blockDragTabOpenPath = null;
          }
        });
    }, BLOCK_DRAG_TAB_OPEN_DELAY_MS);
  }

  private clearBlockDragTabOpen(): void {
    if (this.blockDragTabOpenTimerId !== null) {
      window.clearTimeout(this.blockDragTabOpenTimerId);
      this.blockDragTabOpenTimerId = null;
    }
    this.blockDragTabOpenPath = null;
  }

  private updateBlockDragTabHover(clientX: number, clientY: number): void {
    const tabPath = getNotesTabPathFromPoint(this.doc, clientX, clientY);
    if (!tabPath || tabPath === getCurrentNotePath()) {
      this.clearBlockDragTabOpen();
      return;
    }

    this.scheduleBlockDragTabOpen(tabPath);
  }

  private finishDrag(): void {
    this.draggedRanges = null;
    this.dragStartClientX = null;
    this.dragStartClientY = null;
    this.lastDragClientX = null;
    this.lastDragClientY = null;
    this.pendingDragClientX = null;
    this.pendingDragClientY = null;
    this.dragSourceDoc = null;
    this.dragSourceNotePath = null;
    this.draggedMarkdown = null;
    this.dragSourceMarkdownAfterDelete = null;
    clearPendingCrossNoteBlockDrag();
    this.clearBlockDragTabOpen();
    if (this.dragPointerRafId !== 0) {
      window.cancelAnimationFrame(this.dragPointerRafId);
      this.dragPointerRafId = 0;
    }
    if (this.dragPreview) {
      this.dragPreview.destroy();
      this.dragPreview = null;
    }
    if (this.dragSourceMarker) {
      this.dragSourceMarker.destroy();
      this.dragSourceMarker = null;
    }
    setBlockDraggingVisualState(false);
    this.controls.classList.remove('dragging');
    this.hideDropIndicator();
    this.dragAutoScroll.stop();
    this.detachDragWheelListener();
  }

  private isCrossNoteDrag(): boolean {
    if (!this.draggedRanges) return false;
    const currentNotePath = getCurrentNotePath();
    if (this.dragSourceNotePath && currentNotePath && currentNotePath !== this.dragSourceNotePath) {
      return true;
    }
    return Boolean(this.dragSourceDoc && this.view.state.doc !== this.dragSourceDoc);
  }

  private applyCrossNoteDrop(insertPos: number): boolean {
    const sourceNotePath = this.dragSourceNotePath;
    const sourceMarkdownAfterDelete = this.dragSourceMarkdownAfterDelete;
    const targetNotePath = getCurrentNotePath();
    if (
      !sourceNotePath ||
      sourceMarkdownAfterDelete === null ||
      !targetNotePath ||
      targetNotePath === sourceNotePath
    ) {
      return false;
    }

    const targetMarkdownAfterInsert = insertCrossNoteDraggedMarkdown(
      this.view,
      this.draggedMarkdown,
      insertPos,
      targetNotePath,
    );
    if (targetMarkdownAfterInsert === null) return false;

    void saveCrossNoteBlockDropAfterTargetSave({
      sourceNotePath,
      sourceMarkdownAfterDelete,
      targetNotePath,
      targetMarkdownAfterInsert,
    }).catch(() => undefined);
    return true;
  }

  private readonly handleHandleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    const { ranges: draggableRanges } = this.getDraggableSelection();

    if (draggableRanges.length === 0) return;

    event.preventDefault();
    event.stopPropagation();

    this.draggedRanges = draggableRanges;
    this.dragSourceDoc = this.view.state.doc;
    this.dragSourceNotePath = getCurrentNotePath();
    this.draggedMarkdown = serializeDraggedRangesForMarkdown(this.view, draggableRanges);
    this.dragSourceMarkdownAfterDelete = this.draggedMarkdown
      ? serializeSourceMarkdownAfterDelete(
          this.view,
          draggableRanges,
          this.dragSourceNotePath,
        )
      : null;
    this.attachDragWheelListener();
    this.dragAutoScroll.start();
    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
    this.setPointer(event.clientX, event.clientY);
    setPendingCrossNoteBlockDrag({
      sourceNotePath: this.dragSourceNotePath,
      draggedMarkdown: this.draggedMarkdown,
      sourceMarkdownAfterDelete: this.dragSourceMarkdownAfterDelete,
      dragStartClientX: event.clientX,
      dragStartClientY: event.clientY,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      preview: null,
    });
    const composerText = serializeDraggedRangesForComposer(this.view, draggableRanges);
    setBlockDraggingVisualState(true, composerText ? { text: composerText } : null);
    this.controls.classList.add('dragging');
    this.dragSourceMarker = createBlockDragSourceMarker({
      view: this.view,
      ranges: draggableRanges,
    });

    const preview = createBlockDragPreview({
      view: this.view,
      ranges: draggableRanges,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    if (preview) {
      this.dragPreview = preview;
      setPendingCrossNoteBlockDragPreview(preview);
      preview.element.style.left = `${Math.round(event.clientX - preview.offsetX)}px`;
      preview.element.style.top = `${Math.round(event.clientY - preview.offsetY)}px`;
    }
    this.lastDragClientX = event.clientX;
    this.lastDragClientY = event.clientY;
    this.updateDropTargetByPointer(event.clientX, event.clientY);
  };

  private readonly handleDocumentMouseMove = (event: MouseEvent): void => {
    if (this.draggedRanges) {
      this.setPointer(event.clientX, event.clientY);
      this.lastDragClientX = event.clientX;
      this.lastDragClientY = event.clientY;
      updatePendingCrossNoteBlockDragPointer(event.clientX, event.clientY);
      this.scheduleDragPointerUpdate(event.clientX, event.clientY);
      event.preventDefault();
      return;
    }

    if (this.isBlockSelectionPending()) {
      this.clearPointer();
      this.hideControls();
      return;
    }

    this.setPointer(event.clientX, event.clientY);
    this.scheduleHandleRefresh();
  };

  private readonly handleDocumentPointerMove = (event: PointerEvent): void => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (this.draggedRanges) return;
    if (this.isBlockSelectionPending()) {
      this.clearPointer();
      this.hideControls();
      return;
    }
    this.setPointer(event.clientX, event.clientY);
    this.scheduleHandleRefresh();
  };

  private readonly handleScrollOrResize = (): void => {
    if (this.draggedRanges) {
      this.refreshDragDropAfterScroll();
      return;
    }
    if (this.isBlockSelectionPending()) {
      this.hideControls();
      return;
    }
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  };

  private readonly handleBlockPositionSnapshot = (snapshot: EditorBlockPositionSnapshot | null): void => {
    if (snapshot && snapshot.view !== this.view) return;
    if (this.isBlockSelectionPending()) {
      this.hideControls();
      return;
    }
    if (this.pointerY === null && !this.controls.classList.contains('visible') && !this.draggedRanges) return;

    this.invalidateTargetCache();
    if (this.draggedRanges) {
      if (this.lastDragClientX !== null && this.lastDragClientY !== null) {
        this.scheduleDragPointerUpdate(this.lastDragClientX, this.lastDragClientY);
      }
      return;
    }
    this.scheduleHandleRefresh();
  };

  private readonly handleDocumentWheel = (event: WheelEvent): void => {
    if (!this.draggedRanges || !this.scrollRoot) return;

    const canScrollY = this.scrollRoot.scrollHeight > this.scrollRoot.clientHeight;
    const canScrollX = this.scrollRoot.scrollWidth > this.scrollRoot.clientWidth;
    if (!canScrollY && !canScrollX) return;

    const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, this.scrollRoot.clientHeight);
    const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, this.scrollRoot.clientWidth);
    if (deltaY === 0 && deltaX === 0) return;

    event.preventDefault();
    if (canScrollY && deltaY !== 0) {
      this.scrollRoot.scrollTop += deltaY;
    }
    if (canScrollX && deltaX !== 0) {
      this.scrollRoot.scrollLeft += deltaX;
    }

    this.refreshDragDropAfterScroll();
  };

  private readonly handleDocumentMouseUp = (event: MouseEvent): void => {
    if (!this.draggedRanges) return;
    this.setPointer(event.clientX, event.clientY);
    event.preventDefault();
    this.flushDragPointerUpdate();
    const draggedDistance = this.dragStartClientX === null || this.dragStartClientY === null
      ? 0
      : Math.hypot(event.clientX - this.dragStartClientX, event.clientY - this.dragStartClientY);
    if (
      isOverNotesBlockDropTarget(this.doc, event.clientX, event.clientY)
      || !this.pendingDrop
      || draggedDistance < MIN_DROP_DISTANCE_PX
    ) {
      this.finishDrag();
    } else {
      const ranges = this.draggedRanges;
      const insertPos = this.pendingDrop.insertPos;
      if (this.isCrossNoteDrag()) {
        this.applyCrossNoteDrop(insertPos);
      } else {
        const canMove = canApplyBlockMove(this.view, ranges, insertPos);
        if (canMove) {
          applyBlockMove(this.view, ranges, insertPos);
        }
      }
      this.finishDrag();
    }
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  };

  private readonly handleWindowBlur = (): void => {
    if (this.draggedRanges) {
      this.finishDrag();
    }
    this.clearPointer();
    this.hideControls();
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  };

  private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!this.draggedRanges) return;
    if (event.isComposing || event.key !== 'Escape') return;
    event.preventDefault();
    this.finishDrag();
    this.clearPointer();
    this.hideControls();
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  };
}

export const __testing__ = {
  saveCrossNoteBlockDropAfterTargetSave,
};
