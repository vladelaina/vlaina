import type { EditorView } from '@milkdown/kit/prose/view';

type RecentSkippedCloser = {
  at: number;
  close: string;
  from: number;
  to: number;
};

const recentSkippedClosers = new WeakMap<EditorView, RecentSkippedCloser>();
const DUPLICATE_CLOSER_WINDOW_MS = 32;

function getNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function recordSkippedCloser(
  view: EditorView,
  close: string,
  from: number,
  to: number,
): void {
  recentSkippedClosers.set(view, {
    at: getNow(),
    close,
    from,
    to,
  });
}

export function consumeDuplicateCloseEvent(
  view: EditorView,
  from: number,
  close: string,
): boolean {
  const recent = recentSkippedClosers.get(view);
  if (!recent) return false;

  if (getNow() - recent.at > DUPLICATE_CLOSER_WINDOW_MS) {
    recentSkippedClosers.delete(view);
    return false;
  }

  if (recent.close !== close || recent.to !== from) {
    return false;
  }

  recentSkippedClosers.delete(view);
  return true;
}
