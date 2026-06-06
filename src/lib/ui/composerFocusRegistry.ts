export interface ComposerFocusAdapter {
  focus: () => boolean;
  blur?: () => boolean;
  isFocused: () => boolean;
  containsTarget?: (target: EventTarget | null) => boolean;
  insertText?: (text: string) => boolean;
}

export const MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS = 1024 * 1024;
export const MAX_COMPOSER_ROOT_SCAN_ELEMENTS = 10_000;

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
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let scanned = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    scanned += 1;
    if (scanned > MAX_COMPOSER_ROOT_SCAN_ELEMENTS) {
      return null;
    }
    if (
      node instanceof HTMLElement &&
      node.dataset.chatInput === 'true' &&
      node.getClientRects().length > 0
    ) {
      return node;
    }
  }
  return null;
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

export function canInsertTextIntoComposerValue(currentText: string, text: string): boolean {
  if (!text || text.length > MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS) {
    return false;
  }

  const separatorLength = currentText && !currentText.endsWith('\n') ? 1 : 0;
  return currentText.length + separatorLength + text.length <= MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS;
}

export function insertTextIntoComposer(text: string): boolean {
  const trimmed = text.trim();
  if (!canInsertTextIntoComposerValue('', trimmed)) {
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
  if (!canInsertTextIntoComposerValue(current, trimmed)) {
    return false;
  }

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
