import type { TextEditorSessionState } from './textEditorViewSessionTypes';

export function createTextEditorAnchorPositionRefreshScheduler<TState extends TextEditorSessionState>(args: {
  getEditorState: () => TState | undefined;
  updateEditorPosition: (state: TState, options?: { deferResize?: boolean }) => void;
}) {
  let anchorPositionFrame: number | null = null;

  const clear = () => {
    if (anchorPositionFrame !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(anchorPositionFrame);
    }
    anchorPositionFrame = null;
  };

  const schedule = () => {
    if (typeof window === 'undefined') {
      const state = args.getEditorState();
      if (state?.isOpen) {
        args.updateEditorPosition(state);
      }
      return;
    }

    if (anchorPositionFrame !== null) {
      return;
    }

    anchorPositionFrame = window.requestAnimationFrame(() => {
      anchorPositionFrame = null;
      const state = args.getEditorState();
      if (state?.isOpen) {
        args.updateEditorPosition(state, { deferResize: true });
      }
    });
  };

  return { clear, schedule };
}
