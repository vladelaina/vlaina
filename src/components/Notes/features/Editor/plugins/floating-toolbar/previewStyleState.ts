import type { EditorState } from '@milkdown/kit/prose/state';

export type SelectionColorPreviewSignature = {
  empty: boolean;
  from: number;
  to: number;
} | null;

export type PreviewScrollSnapshot = {
  element: HTMLElement;
  releaseGuard: () => void;
  scrollLeft: number;
  scrollTop: number;
};

export type PreviewScrollGuard = {
  count: number;
  originalOverflowAnchor: string;
  originalOverflowAnchorPriority: string;
};

export const previewStyleState: {
  previewOverlay: {
    key: string;
    node: HTMLElement;
    originalDoc: EditorState['doc'];
    originalViewDisplay: string;
    previewState: EditorState;
    viewDom: HTMLElement;
  } | null;
  previewScrollGuards: WeakMap<HTMLElement, PreviewScrollGuard>;
  selectionColorPreview: {
    key: string;
    originalDoc: EditorState['doc'];
    selection: SelectionColorPreviewSignature;
    styleMutations: Array<{
      cssText: string;
      node: HTMLElement;
    }>;
    viewDom: HTMLElement;
  } | null;
} = {
  previewOverlay: null,
  previewScrollGuards: new WeakMap<HTMLElement, PreviewScrollGuard>(),
  selectionColorPreview: null,
};
