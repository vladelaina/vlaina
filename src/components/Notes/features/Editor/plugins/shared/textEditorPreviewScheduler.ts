import type {
  TextEditorPreviewArgs,
  TextEditorSessionRefs,
  TextEditorSessionState,
} from './textEditorViewSessionTypes';

export function createTextEditorPreviewScheduler<
  TState extends TextEditorSessionState,
  TRefs extends TextEditorSessionRefs,
>(
  previewInput: (args: TextEditorPreviewArgs<TState, TRefs>) => void,
  previewInputDebounceMs: number,
) {
  let previewInputTimer: number | null = null;
  let pendingPreviewInputArgs: TextEditorPreviewArgs<TState, TRefs> | null = null;

  const clear = () => {
    pendingPreviewInputArgs = null;
    if (previewInputTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(previewInputTimer);
    }
    previewInputTimer = null;
  };

  const flush = () => {
    if (!pendingPreviewInputArgs) {
      return;
    }
    const nextArgs = pendingPreviewInputArgs;
    clear();
    previewInput(nextArgs);
  };

  const schedule = (previewArgs: TextEditorPreviewArgs<TState, TRefs>) => {
    pendingPreviewInputArgs = previewArgs;
    if (previewInputDebounceMs <= 0 || typeof window === 'undefined') {
      flush();
      return;
    }

    if (previewInputTimer !== null) {
      window.clearTimeout(previewInputTimer);
    }
    previewInputTimer = window.setTimeout(() => {
      previewInputTimer = null;
      flush();
    }, previewInputDebounceMs);
  };

  return { clear, flush, schedule };
}
