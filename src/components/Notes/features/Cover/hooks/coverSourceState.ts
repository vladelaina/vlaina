export interface CoverSourceState {
  resolvedSrc: string | null;
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
  | { type: 'url-switch-reset' }
  | { type: 'source-clear' }
  | { type: 'resolve-error' }
  | { type: 'resolve-success'; imageUrl: string };

export const initialCoverSourceState: CoverSourceState = {
  resolvedSrc: null,
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
        isImageReady: false,
        isError: false,
      };
    case 'source-clear':
      return {
        ...state,
        resolvedSrc: null,
        previewSrc: null,
        isError: false,
        isSelectionCommitting: false,
      };
    case 'resolve-error':
      return {
        ...state,
        resolvedSrc: null,
        previewSrc: null,
        isError: true,
        isSelectionCommitting: false,
      };
    case 'resolve-success':
      return {
        ...state,
        resolvedSrc: action.imageUrl,
        previewSrc: null,
        isError: false,
        isSelectionCommitting: false,
      };
    default:
      return state;
  }
}
