export interface ComposerFocusAdapter {
  focus: () => boolean;
  blur?: () => boolean;
  isFocused: () => boolean;
  containsTarget?: (target: EventTarget | null) => boolean;
  insertText?: (text: string) => boolean;
}

let activeAdapter: ComposerFocusAdapter | null = null;

export function isMountedVisibleElement(element: HTMLElement | null): boolean {
  return !!element && element.isConnected && element.getClientRects().length > 0;
}

export function focusVisibleTextareaAt(
  input: HTMLTextAreaElement | null,
  position?: number,
): boolean {
  if (!input || !isMountedVisibleElement(input)) {
    return false;
  }

  input.focus({ preventScroll: true });
  if (document.activeElement !== input) {
    return false;
  }

  const nextPosition = position ?? input.value.length;
  input.setSelectionRange(nextPosition, nextPosition);
  return true;
}

function queryComposerRoot(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-chat-input="true"]'))
    .find((root) => root.getClientRects().length > 0) ?? null;
}

function queryComposerTextarea(): HTMLTextAreaElement | null {
  return queryComposerRoot()?.querySelector('textarea') ?? null;
}

export function registerComposerFocusAdapter(adapter: ComposerFocusAdapter): () => void {
  activeAdapter = adapter;
  return () => {
    if (activeAdapter === adapter) {
      activeAdapter = null;
    }
  };
}

export function focusComposerInput(): boolean {
  let result = false;
  if (activeAdapter?.focus()) {
    result = activeAdapter.isFocused();
  }

  if (!result) {
    const input = queryComposerTextarea();
    result = focusVisibleTextareaAt(input);
  }

  return result;
}

export function selectComposerInputAll(): boolean {
  const input = queryComposerTextarea();
  if (!input) {
    return false;
  }
  const length = input.value.length;
  if (!focusVisibleTextareaAt(input, 0)) {
    return false;
  }
  input.setSelectionRange(0, length);
  return true;
}

export function insertTextIntoComposer(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  const fromAdapter = activeAdapter?.insertText?.(trimmed) ?? false;
  if (fromAdapter) {
    return true;
  }

  const input = queryComposerTextarea();
  if (!input) {
    return false;
  }

  if (!focusVisibleTextareaAt(input)) {
    return false;
  }

  const current = input.value;
  const separator = current && !current.endsWith('\n') ? '\n' : '';
  const next = `${current}${separator}${trimmed}`;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  )?.set;
  setter?.call(input, next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const pos = next.length;
  input.setSelectionRange(pos, pos);
  input.scrollTop = input.scrollHeight;
  return true;
}

export function isComposerInputFocused(): boolean {
  let result = activeAdapter?.isFocused() ?? false;
  if (!result) {
    const input = queryComposerTextarea();
    result = !!input && document.activeElement === input;
  }
  return result;
}

export function blurComposerInput(): boolean {
  let result = activeAdapter?.blur?.() ?? false;
  if (!result) {
    const input = queryComposerTextarea();
    if (input) {
      input.blur();
      result = document.activeElement !== input;
    }
  }
  return result;
}

export function isComposerFocusTarget(target: EventTarget | null): boolean {
  let result = activeAdapter?.containsTarget?.(target) ?? false;
  if (!result && target instanceof Node) {
    const root = queryComposerRoot();
    result = !!root && root.contains(target);
  }
  return result;
}
