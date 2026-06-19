const OPEN_MARKDOWN_TARGET_EVENT = 'app-open-markdown-target';
const MAX_PENDING_OPEN_MARKDOWN_TARGETS = 8;

const listeners = new Set<(absolutePath: string) => void>();
const pendingTargets: string[] = [];
let globalListenerAttached = false;

function getOpenMarkdownTargetFromEvent(event: Event): string | null {
  const customEvent = event as CustomEvent<string>;
  return typeof customEvent.detail === 'string' && customEvent.detail.trim()
    ? customEvent.detail
    : null;
}

function enqueuePendingTarget(absolutePath: string): void {
  pendingTargets.push(absolutePath);
  if (pendingTargets.length > MAX_PENDING_OPEN_MARKDOWN_TARGETS) {
    pendingTargets.splice(0, pendingTargets.length - MAX_PENDING_OPEN_MARKDOWN_TARGETS);
  }
}

function handleOpenMarkdownTargetEvent(event: Event): void {
  const absolutePath = getOpenMarkdownTargetFromEvent(event);
  if (!absolutePath) return;

  if (listeners.size === 0) {
    enqueuePendingTarget(absolutePath);
    return;
  }

  for (const listener of listeners) {
    listener(absolutePath);
  }
}

function ensureGlobalOpenMarkdownTargetListener(): void {
  if (globalListenerAttached || typeof window === 'undefined') return;
  window.addEventListener(OPEN_MARKDOWN_TARGET_EVENT, handleOpenMarkdownTargetEvent);
  globalListenerAttached = true;
}

export function dispatchOpenMarkdownTargetEvent(absolutePath: string): void {
  ensureGlobalOpenMarkdownTargetListener();
  window.dispatchEvent(
    new CustomEvent<string>(OPEN_MARKDOWN_TARGET_EVENT, {
      detail: absolutePath,
    }),
  );
}

export function subscribeOpenMarkdownTargetEvent(
  listener: (absolutePath: string) => void,
): () => void {
  ensureGlobalOpenMarkdownTargetListener();
  listeners.add(listener);

  if (pendingTargets.length > 0) {
    const targets = pendingTargets.splice(0);
    for (const target of targets) {
      listener(target);
    }
  }

  return () => {
    listeners.delete(listener);
  };
}

ensureGlobalOpenMarkdownTargetListener();
