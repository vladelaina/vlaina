import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import type { BlockDragPreviewHandle, BlockDragSourceMarkerHandle } from './blockDragPreview';
import { createBlockControlsDom } from './blockControlsDom';
import { subscribeCurrentEditorBlockPositionSnapshot } from '../../utils/editorBlockPositionCache';
import type { VerticalEdgeAutoScrollHandle } from './edgeAutoScroll';
import { createVerticalEdgeAutoScroll } from './edgeAutoScroll';
import type { DropTarget, HandleBlockTarget } from './blockControlsInteractions';
import { SCROLL_ROOT_SELECTOR, saveCrossNoteBlockDropAfterTargetSave } from './blockControlsViewSessionHelpers';
import { installBlockControlsViewSessionDragHandlers } from './blockControlsViewSessionDragHandlers';
import { installBlockControlsViewSessionLifecycle } from './blockControlsViewSessionLifecycle';
import { installBlockControlsViewSessionPointer } from './blockControlsViewSessionPointer';
import { installBlockControlsViewSessionTargets } from './blockControlsViewSessionTargets';
import { installBlockControlsViewSessionViewportHandlers } from './blockControlsViewSessionViewportHandlers';

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
    installBlockControlsViewSessionDragHandlers(this);
    installBlockControlsViewSessionViewportHandlers(this);
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
}

installBlockControlsViewSessionLifecycle(BlockControlsViewSession.prototype);
installBlockControlsViewSessionPointer(BlockControlsViewSession.prototype);
installBlockControlsViewSessionTargets(BlockControlsViewSession.prototype);

export const __testing__ = {
  saveCrossNoteBlockDropAfterTargetSave,
};
