import type { FileTreePointerDragSession } from './fileTreePointerDragTypes';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function stopFileTreePointerAutoScroll(session: FileTreePointerDragSession | null) {
  if (session?.autoScrollFrame == null) {
    return;
  }

  window.cancelAnimationFrame(session.autoScrollFrame);
  session.autoScrollFrame = null;
}

export function queueFileTreePointerAutoScroll(
  session: FileTreePointerDragSession | null,
  updateDropTarget: () => void,
) {
  if (!session?.activated || session.autoScrollFrame != null) {
    return;
  }

  const stepAutoScroll = () => {
    if (!session.activated) {
      return;
    }

    const scrollRoot = session.scrollRoot;
    session.autoScrollFrame = null;

    if (!scrollRoot) {
      return;
    }

    const rect = scrollRoot.getBoundingClientRect();
    const maxScrollTop = Math.max(scrollRoot.scrollHeight - scrollRoot.clientHeight, 0);
    if (maxScrollTop <= 0) {
      return;
    }

    const edgeSize = Math.min(96, Math.max(40, rect.height * 0.24));
    let delta = 0;

    if (session.lastClientY < rect.top + edgeSize) {
      delta = -((rect.top + edgeSize - session.lastClientY) / edgeSize) * 28;
    } else if (session.lastClientY > rect.bottom - edgeSize) {
      delta = ((session.lastClientY - (rect.bottom - edgeSize)) / edgeSize) * 28;
    }

    if (delta === 0) {
      return;
    }

    const nextScrollTop = clamp(scrollRoot.scrollTop + delta, 0, maxScrollTop);
    if (nextScrollTop === scrollRoot.scrollTop) {
      return;
    }

    scrollRoot.scrollTop = nextScrollTop;
    updateDropTarget();
    session.autoScrollFrame = window.requestAnimationFrame(stepAutoScroll);
  };

  session.autoScrollFrame = window.requestAnimationFrame(stepAutoScroll);
}
