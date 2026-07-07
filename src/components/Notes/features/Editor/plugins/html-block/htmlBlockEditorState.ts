import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { PluginKey } from '@milkdown/kit/prose/state';

export const HTML_BLOCK_SELECTOR = '[data-type="html-block"]';

const INTERNAL_HTML_BLOCK_VALUES = new Set([
  '<!--vlaina-markdown-blank-line-->',
  '<!--vlaina-rendered-html-boundary-blank-line-->',
  '<!--vlaina-markdown-tight-heading-->',
]);

export interface HtmlBlockEditorState {
  isOpen: boolean;
  value: string;
  position: { x: number; y: number };
  nodePos: number;
}

export interface HtmlBlockEditorSessionRefs {
  textareaElement: HTMLTextAreaElement | null;
  draftValue: string;
  initialValue: string;
}

interface HtmlBlockNodeLike {
  type: { name: string };
  attrs: Record<string, unknown> & { value?: string };
  nodeSize?: number;
}

export interface HtmlBlockEditorViewLike<TTransaction = unknown> {
  dom: HTMLElement;
  state: {
    doc: {
      resolve: (pos: number) => {
        depth: number;
        node: (depth: number) => ProseNode;
        before: (depth: number) => number;
      };
      nodeAt: (pos: number) => HtmlBlockNodeLike | null;
    };
    tr: {
      setMeta?: (key: PluginKey<HtmlBlockEditorState>, value: HtmlBlockEditorState) => TTransaction;
      setNodeMarkup: (
        pos: number,
        type: undefined,
        attrs: Record<string, unknown>
      ) => TTransaction;
      delete: (from: number, to: number) => TTransaction;
    };
  };
  dispatch: (tr: TTransaction) => void;
  posAtDOM: (node: Node, offset: number) => number;
  nodeDOM?: (pos: number) => Node | null;
}

export const htmlBlockEditorPluginKey =
  new PluginKey<HtmlBlockEditorState>('htmlBlockEditor');

export function createClosedHtmlBlockEditorState(): HtmlBlockEditorState {
  return {
    isOpen: false,
    value: '',
    position: { x: 0, y: 0 },
    nodePos: -1,
  };
}

export function createOpenHtmlBlockEditorState(args: {
  value: string;
  position: { x: number; y: number };
  nodePos: number;
}): HtmlBlockEditorState {
  return {
    isOpen: true,
    value: args.value,
    position: args.position,
    nodePos: args.nodePos,
  };
}

export function getSuppressDeadline() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function isEditableHtmlBlockValue(value: unknown): value is string {
  return typeof value === 'string' && !INTERNAL_HTML_BLOCK_VALUES.has(value.trim());
}
