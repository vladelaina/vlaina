import { logFocusTrace } from '@/lib/debug/focusTrace';

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
  logFocusTrace('registry.register.start', {
    replacingExisting: !!activeAdapter
  });
  activeAdapter = adapter;
  logFocusTrace('registry.register.done');
  return () => {
    logFocusTrace('registry.unregister.start', {
      isCurrent: activeAdapter === adapter
    });
    if (activeAdapter === adapter) {
      activeAdapter = null;
    }
    logFocusTrace('registry.unregister.done', {
      hasAdapter: !!activeAdapter
    });
  };
}

export function focusComposerInput(): boolean {
  const hasAdapter = !!activeAdapter;
  let result = activeAdapter?.focus() ?? false;

  if (!result) {
    const input = queryComposerTextarea();
    if (input) {
      input.focus({ preventScroll: true });
      const pos = input.value.length;
      input.setSelectionRange(pos, pos);
      result = document.activeElement === input;
      logFocusTrace('registry.focusComposerInput.domFallback', {
        foundInput: true,
        caret: pos,
        result
      });
    } else {
      logFocusTrace('registry.focusComposerInput.domFallback', {
        foundInput: false,
        result: false
      });
    }
  }

  logFocusTrace('registry.focusComposerInput', {
    hasAdapter,
    result
  });
  return result;
}

export function isComposerInputFocused(): boolean {
  const hasAdapter = !!activeAdapter;
  let result = activeAdapter?.isFocused() ?? false;
  if (!result) {
    const input = queryComposerTextarea();
    result = !!input && document.activeElement === input;
    logFocusTrace('registry.isComposerInputFocused.domFallback', {
      foundInput: !!input,
      result
    });
  }
  logFocusTrace('registry.isComposerInputFocused', {
    hasAdapter,
    result
  });
  return result;
}

export function blurComposerInput(): boolean {
  const hasAdapter = !!activeAdapter;
  let result = activeAdapter?.blur?.() ?? false;
  if (!result) {
    const input = queryComposerTextarea();
    if (input) {
      input.blur();
      result = document.activeElement !== input;
      logFocusTrace('registry.blurComposerInput.domFallback', {
        foundInput: true,
        result
      });
    } else {
      logFocusTrace('registry.blurComposerInput.domFallback', {
        foundInput: false,
        result: false
      });
    }
  }
  logFocusTrace('registry.blurComposerInput', {
    hasAdapter,
    result
  });
  return result;
}

export function isComposerFocusTarget(target: EventTarget | null): boolean {
  const hasAdapter = !!activeAdapter;
  let result = activeAdapter?.containsTarget?.(target) ?? false;
  if (!result && target instanceof Node) {
    const root = queryComposerRoot();
    result = !!root && root.contains(target);
    logFocusTrace('registry.isComposerFocusTarget.domFallback', {
      foundRoot: !!root,
      result
    });
  }
  logFocusTrace('registry.isComposerFocusTarget', {
    hasAdapter,
    result
  });
  return result;
}
