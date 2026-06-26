import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { TypewriterModeView } from './typewriterModeView';

function setTypewriterMode(typewriterMode: boolean): void {
  useUnifiedStore.setState((state) => ({
    data: {
      ...state.data,
      settings: {
        ...state.data.settings,
        markdown: {
          ...state.data.settings.markdown,
          typewriterMode,
        },
      },
    },
  }));
}

function createAnimationFrameMock() {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const requestAnimationFrame = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback: FrameRequestCallback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    });
  const cancelAnimationFrame = vi
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation((id: number) => {
      callbacks.delete(id);
    });

  return {
    requestAnimationFrame,
    cancelAnimationFrame,
    flush() {
      const pending = Array.from(callbacks.entries());
      callbacks.clear();
      for (const [id, callback] of pending) {
        callback(id);
      }
    },
  };
}

function defineScrollMetrics(element: HTMLElement, metrics: {
  scrollHeight: number;
  clientHeight: number;
  rect: { top: number; bottom: number };
}): void {
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: metrics.scrollHeight,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: metrics.clientHeight,
  });
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: metrics.rect.top,
      left: 0,
      right: 600,
      width: 600,
      height: metrics.rect.bottom - metrics.rect.top,
      top: metrics.rect.top,
      bottom: metrics.rect.bottom,
      toJSON: () => ({}),
    }),
  });
}

function createTypewriterHarness(options: { enabled: boolean }) {
  setTypewriterMode(options.enabled);

  const scrollRoot = document.createElement('div');
  scrollRoot.setAttribute('data-note-scroll-root', 'true');
  defineScrollMetrics(scrollRoot, {
    scrollHeight: 1000,
    clientHeight: 400,
    rect: { top: 0, bottom: 400 },
  });
  scrollRoot.scrollTop = 100;

  const dom = document.createElement('div');
  scrollRoot.append(dom);
  document.body.append(scrollRoot);

  const prevState = {
    doc: { id: 'previous-doc' },
    selection: { empty: true, head: 1 },
  } as unknown as EditorView['state'];
  const state = {
    doc: { id: 'next-doc' },
    selection: { empty: true, head: 1 },
  } as unknown as EditorView['state'];
  const view = {
    dom,
    state,
    hasFocus: vi.fn(() => true),
    coordsAtPos: vi.fn(() => ({ top: 280, bottom: 300 })),
  } as unknown as EditorView;
  const pluginView = new TypewriterModeView(view);

  return {
    scrollRoot,
    dom,
    prevState,
    state,
    view,
    pluginView,
    input() {
      dom.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        inputType: 'insertText',
      }));
    },
    enter() {
      dom.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter',
      }));
    },
    pressKey(key: string) {
      dom.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key,
      }));
    },
    cleanup() {
      pluginView.destroy();
      scrollRoot.remove();
    },
  };
}

describe('TypewriterModeView', () => {
  let animationFrame: ReturnType<typeof createAnimationFrameMock>;

  beforeEach(() => {
    animationFrame = createAnimationFrameMock();
    setTypewriterMode(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
    setTypewriterMode(false);
  });

  it('reacts to runtime setting changes without remounting the editor plugin view', () => {
    const harness = createTypewriterHarness({ enabled: false });

    try {
      harness.input();
      harness.pluginView.update(harness.view, harness.prevState);
      animationFrame.flush();

      expect(harness.scrollRoot.scrollTop).toBe(100);
      expect(harness.view.coordsAtPos).not.toHaveBeenCalled();

      setTypewriterMode(true);

      harness.input();
      harness.pluginView.update(harness.view, harness.prevState);
      animationFrame.flush();

      expect(harness.scrollRoot.scrollTop).toBe(190);
      expect(harness.view.coordsAtPos).toHaveBeenCalledTimes(1);
    } finally {
      harness.cleanup();
    }
  });

  it('cancels a pending center operation when the setting is turned off', () => {
    const harness = createTypewriterHarness({ enabled: true });

    try {
      harness.input();
      harness.pluginView.update(harness.view, harness.prevState);

      expect(animationFrame.requestAnimationFrame).toHaveBeenCalledTimes(1);

      setTypewriterMode(false);
      animationFrame.flush();

      expect(animationFrame.cancelAnimationFrame).toHaveBeenCalledTimes(1);
      expect(harness.scrollRoot.scrollTop).toBe(100);
      expect(harness.view.coordsAtPos).not.toHaveBeenCalled();
    } finally {
      harness.cleanup();
    }
  });

  it('centers after Enter key edits even without a beforeinput event', () => {
    const harness = createTypewriterHarness({ enabled: true });

    try {
      harness.enter();
      harness.pluginView.update(harness.view, harness.prevState);
      animationFrame.flush();

      expect(harness.scrollRoot.scrollTop).toBe(190);
      expect(harness.view.coordsAtPos).toHaveBeenCalledTimes(1);
    } finally {
      harness.cleanup();
    }
  });

  it('centers after Backspace and Delete key edits even without a beforeinput event', () => {
    for (const key of ['Backspace', 'Delete']) {
      const harness = createTypewriterHarness({ enabled: true });

      try {
        harness.pressKey(key);
        harness.pluginView.update(harness.view, harness.prevState);
        animationFrame.flush();

        expect(harness.scrollRoot.scrollTop).toBe(190);
        expect(harness.view.coordsAtPos).toHaveBeenCalledTimes(1);
      } finally {
        harness.cleanup();
      }
    }
  });

  it('centers after list indent and history shortcut edits', () => {
    for (const eventInit of [
      { key: 'Tab' },
      { key: 'z', ctrlKey: true },
      { key: 'z', metaKey: true, shiftKey: true },
      { key: 'y', ctrlKey: true },
    ]) {
      const harness = createTypewriterHarness({ enabled: true });

      try {
        harness.dom.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          ...eventInit,
        }));
        harness.pluginView.update(harness.view, harness.prevState);
        animationFrame.flush();

        expect(harness.scrollRoot.scrollTop).toBe(190);
        expect(harness.view.coordsAtPos).toHaveBeenCalledTimes(1);
      } finally {
        harness.cleanup();
      }
    }
  });

  it('does not use another notes scroll root when the editor is outside one', () => {
    const harness = createTypewriterHarness({ enabled: true });
    const strayRoot = document.createElement('div');
    strayRoot.setAttribute('data-note-scroll-root', 'true');
    defineScrollMetrics(strayRoot, {
      scrollHeight: 1000,
      clientHeight: 400,
      rect: { top: 0, bottom: 400 },
    });
    strayRoot.scrollTop = 100;
    document.body.append(strayRoot);

    harness.scrollRoot.removeAttribute('data-note-scroll-root');

    try {
      harness.input();
      harness.pluginView.update(harness.view, harness.prevState);
      animationFrame.flush();

      expect(strayRoot.scrollTop).toBe(100);
      expect(harness.view.coordsAtPos).not.toHaveBeenCalled();
    } finally {
      strayRoot.remove();
      harness.cleanup();
    }
  });

  it('cancels pending work on destroy', () => {
    const harness = createTypewriterHarness({ enabled: true });

    harness.input();
    harness.pluginView.update(harness.view, harness.prevState);
    harness.pluginView.destroy();
    animationFrame.flush();

    expect(animationFrame.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(harness.scrollRoot.scrollTop).toBe(100);
    expect(harness.view.coordsAtPos).not.toHaveBeenCalled();
    harness.scrollRoot.remove();
  });
});
