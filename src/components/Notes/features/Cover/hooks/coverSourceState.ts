export interface CoverSourceState {
  resolvedSrc: string | null;
  resolvedAssetPath: string | null;
  resolvedSourceKey: string | null;
  previewSrc: string | null;
  isImageReady: boolean;
  isError: boolean;
  isSelectionCommitting: boolean;
}

export type CoverSourceAction =
  | { type: 'preview-set'; src: string | null }
  | { type: 'selection-commit-start' }
  | { type: 'selection-commit-end' }
  | { type: 'image-ready-set'; ready: boolean }
  | { type: 'url-switch-reset'; preservePreview?: boolean }
  | { type: 'url-switch-resolved'; imageUrl: string; assetPath: string; sourceKey: string }
  | { type: 'source-clear' }
  | { type: 'resolve-error' }
  | { type: 'resolve-success'; imageUrl: string; assetPath: string; sourceKey: string };

export const initialCoverSourceState: CoverSourceState = {
  resolvedSrc: null,
  resolvedAssetPath: null,
  resolvedSourceKey: null,
  previewSrc: null,
  isImageReady: false,
  isError: false,
  isSelectionCommitting: false,
};

export function coverSourceReducer(state: CoverSourceState, action: CoverSourceAction): CoverSourceState {
  switch (action.type) {
    case 'preview-set':
      return {
        ...state,
        previewSrc: action.src,
        isSelectionCommitting: action.src ? false : state.isSelectionCommitting,
      };
    case 'selection-commit-start':
      return {
        ...state,
        isSelectionCommitting: true,
      };
    case 'selection-commit-end':
      return {
        ...state,
        isSelectionCommitting: false,
      };
    case 'image-ready-set':
      return {
        ...state,
        isImageReady: action.ready,
      };
    case 'url-switch-reset':
      return {
        ...state,
        resolvedSrc: null,
        resolvedAssetPath: null,
        resolvedSourceKey: null,
        previewSrc: action.preservePreview ? state.previewSrc : null,
        isImageReady: false,
        isError: false,
      };
    case 'url-switch-resolved':
      return {
        ...state,
        resolvedSrc: action.imageUrl,
        resolvedAssetPath: action.assetPath,
        resolvedSourceKey: action.sourceKey,
        isImageReady: false,
        isError: false,
      };
    case 'source-clear':
      return {
        ...state,
        resolvedSrc: null,
        resolvedAssetPath: null,
        resolvedSourceKey: null,
        previewSrc: null,
        isError: false,
        isSelectionCommitting: false,
      };
    case 'resolve-error':
      return {
        ...state,
        resolvedSrc: null,
        resolvedAssetPath: null,
        resolvedSourceKey: null,
        previewSrc: null,
        isError: true,
        isSelectionCommitting: false,
      };
    case 'resolve-success':
      return {
        ...state,
        resolvedSrc: action.imageUrl,
        resolvedAssetPath: action.assetPath,
        resolvedSourceKey: action.sourceKey,
        previewSrc: null,
        isError: false,
        isSelectionCommitting: false,
      };
    default:
      return state;
  }
}
