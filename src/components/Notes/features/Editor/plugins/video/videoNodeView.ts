import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { EditorView, NodeView } from '@milkdown/kit/prose/view';
import type { VideoAttrs } from './types';
import { getVideoAttrsDebug } from './videoAttrsDebug';
import { selectVideoBlock } from './videoBlockSelection';
import { createVideoDom } from './videoDom';
import { getDomRectDebug, getEventTargetDebug, logVideoDebug } from './videoDebug';
import { shouldStopVideoNodeEvent } from './videoNodeViewEvents';

let videoNodeViewIdCounter = 0;

export class VideoNodeView implements NodeView {
  dom: HTMLElement;
  private node: ProseMirrorNode;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;
  private readonly debugId = ++videoNodeViewIdCounter;
  private readonly handleDoubleClick: (event: MouseEvent) => void;
  private readonly handleMouseDown: (event: MouseEvent) => void;
  private readonly handleWindowMouseMove: (event: MouseEvent) => void;
  private readonly handleWindowMouseUp: () => void;
  private mouseDownState: {
    x: number;
    y: number;
    selected: boolean;
    timeout: number;
  } | null = null;
  private selectionShield: HTMLElement | null = null;
  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.dom = createVideoDom(node.attrs as VideoAttrs);
    this.handleDoubleClick = (event) => this.handleNodeDoubleClick(event);
    this.handleMouseDown = (event) => this.handleNodeMouseDown(event);
    this.handleWindowMouseMove = (event) => this.handlePointerMove(event);
    this.handleWindowMouseUp = () => {
      this.clearMouseDownState();
    };
    this.dom.addEventListener('dblclick', this.handleDoubleClick);
    this.dom.addEventListener('mousedown', this.handleMouseDown, true);
  }
  private handleNodeDoubleClick(event: MouseEvent) {
    if (event.shiftKey) {
      return;
    }
    const pos = this.getPos();
    if (typeof pos !== 'number') {
      logVideoDebug('nodeview_dblclick_ignored', {
        id: this.debugId,
        reason: 'missingPos',
        target: getEventTargetDebug(event.target),
      });
      return;
    }
    event.preventDefault();
    selectVideoBlock(this.view, this.node, pos);
    this.view.focus();
  }
  private handleNodeMouseDown(event: MouseEvent) {
    if (event.button !== 0 || event.shiftKey) {
      return;
    }
    this.clearMouseDownState();
    this.mouseDownState = {
      x: event.clientX,
      y: event.clientY,
      selected: false,
      timeout: window.setTimeout(() => {
        this.selectVideoBlockFromPointerHold();
      }, 180),
    };
    window.addEventListener('mousemove', this.handleWindowMouseMove, true);
    window.addEventListener('mouseup', this.handleWindowMouseUp, true);
    this.selectVideoBlockFromPointerHold('mouse-down');
  }
  private handlePointerMove(event: MouseEvent) {
    const state = this.mouseDownState;
    if (!state || state.selected) return;
    const dx = Math.abs(event.clientX - state.x);
    const dy = Math.abs(event.clientY - state.y);
    if (dx < 4 && dy < 4) return;
    this.selectVideoBlockFromPointerHold('move-threshold', {
      dx,
      dy,
      x: event.clientX,
      y: event.clientY,
      target: getEventTargetDebug(event.target),
    });
  }
  private safeGetPos() {
    try {
      return this.getPos();
    } catch {
      return undefined;
    }
  }
  private selectVideoBlockFromPointerHold(reason: 'mouse-down' | 'hold-timeout' | 'move-threshold' = 'hold-timeout', details?: Record<string, unknown>) {
    const state = this.mouseDownState;
    if (!state || state.selected) return;
    const pos = this.getPos();
    if (typeof pos !== 'number') {
      logVideoDebug('nodeview_pointer_select_failed', {
        id: this.debugId,
        reason,
        failure: 'missingPos',
        details,
      });
      return;
    }
    state.selected = true;
    selectVideoBlock(this.view, this.node, pos);
    this.view.focus();
  }
  private hideSelectionShield() {
    if (!this.selectionShield) return;
    this.selectionShield.remove();
    this.selectionShield = null;
  }
  private clearMouseDownState() {
    if (this.mouseDownState) {
      window.clearTimeout(this.mouseDownState.timeout);
      this.mouseDownState = null;
    }
    this.hideSelectionShield();
    window.removeEventListener('mousemove', this.handleWindowMouseMove, true);
    window.removeEventListener('mouseup', this.handleWindowMouseUp, true);
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) {
      logVideoDebug('nodeview_update_rejected', {
        id: this.debugId,
        previousType: this.node.type.name,
        nextType: node.type.name,
      });
      return false;
    }
    if (JSON.stringify(node.attrs) === JSON.stringify(this.node.attrs)) {
      this.node = node;
      return true;
    }

    const previousAttrs = this.node.attrs as VideoAttrs;
    this.node = node;
    this.dom.removeEventListener('dblclick', this.handleDoubleClick);
    this.dom.removeEventListener('mousedown', this.handleMouseDown, true);
    const nextDom = createVideoDom(node.attrs as VideoAttrs);
    this.dom.replaceWith(nextDom);
    this.dom = nextDom;
    this.dom.addEventListener('dblclick', this.handleDoubleClick);
    this.dom.addEventListener('mousedown', this.handleMouseDown, true);
    this.selectionShield = null;
    logVideoDebug('nodeview_update_replace_dom', {
      id: this.debugId,
      pos: this.safeGetPos(),
      previous: getVideoAttrsDebug(previousAttrs),
      next: getVideoAttrsDebug(node.attrs as VideoAttrs),
      rect: getDomRectDebug(this.dom),
    });
    return true;
  }

  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode');
    this.hideSelectionShield();
  }

  stopEvent(event: Event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return false;
    return shouldStopVideoNodeEvent({
      event,
      target,
      debugId: this.debugId,
      view: this.view,
      shieldVisible: Boolean(this.selectionShield),
    });
  }

  ignoreMutation() {
    return true;
  }

  destroy() {
    this.clearMouseDownState();
    this.dom.removeEventListener('dblclick', this.handleDoubleClick);
    this.dom.removeEventListener('mousedown', this.handleMouseDown, true);
  }
}
