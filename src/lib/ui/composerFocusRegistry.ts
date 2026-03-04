export interface ComposerFocusAdapter {
  focus: () => boolean;
  blur?: () => boolean;
  isFocused: () => boolean;
  containsTarget?: (target: EventTarget | null) => boolean;
}

let activeAdapter: ComposerFocusAdapter | null = null;

function queryComposerRoot(): HTMLElement | null {
  return document.querySelector('[data-chat-input="true"]') as HTMLElement | null;
}

function queryComposerTextarea(): HTMLTextAreaElement | null {
  return document.querySelector('[data-chat-input="true"] textarea') as HTMLTextAreaElement | null;
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
  let result = activeAdapter?.focus() ?? false;

  if (!result) {
    const input = queryComposerTextarea();
    if (input) {
      input.focus({ preventScroll: true });
      const pos = input.value.length;
      input.setSelectionRange(pos, pos);
      result = document.activeElement === input;
    }
  }

  return result;
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
