import type { EditorView } from '@milkdown/kit/prose/view';

export function shouldStopVideoNodeEvent(args: {
  event: Event;
  target: HTMLElement;
  debugId: number;
  view: EditorView;
  shieldVisible: boolean;
}) {
  const { event, target } = args;

  if (event instanceof MouseEvent && event.shiftKey) {
    return true;
  }

  if (event.type === 'dblclick') {
    return true;
  }

  if (target.closest('iframe, video')) {
    return true;
  }

  return false;
}
