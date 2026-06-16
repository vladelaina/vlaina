import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTagTokenBoundaryAtTextblock, TextBlockCaretOverlayView } from './textBlockCaretOverlayPlugin';

function createParent(text: string) {
  return {
    content: { size: text.length },
    textBetween: vi.fn((from: number, to: number) => text.slice(from, to)),
    get textContent() {
      throw new Error('aggregate parent textContent should not be read');
    },
  };
}

class TestResizeObserver {
  static instances: TestResizeObserver[] = [];

  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(readonly callback: ResizeObserverCallback) {
    TestResizeObserver.instances.push(this);
  }
}

function createTextblockSelection() {
  const text = 'alpha';
  return {
    empty: true,
    head: 1,
    $from: {
      parent: {
        content: { size: text.length },
        textBetween: vi.fn((from: number, to: number) => text.slice(from, to)),
        isTextblock: true,
      },
      parentOffset: 1,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  TestResizeObserver.instances = [];
  document.body.innerHTML = '';
});

describe('textBlockCaretOverlayPlugin', () => {
  it('detects a tag token boundary without reading aggregate text', () => {
    const parent = createParent('hello #tag');

    expect(isTagTokenBoundaryAtTextblock(parent, 10)).toBe(true);
    expect(parent.textBetween).toHaveBeenCalledWith(0, 10, '\0', '\0');
  });

  it('does not treat a tag token as complete when another token character follows', () => {
    const parent = createParent('hello #tagx');

    expect(isTagTokenBoundaryAtTextblock(parent, 10)).toBe(false);
    expect(parent.textBetween).toHaveBeenCalledWith(10, 11, '\0', '\0');
  });

  it('limits tag boundary lookbehind text reads', () => {
    const parent = createParent(`${'x'.repeat(512)} #tag`);

    expect(isTagTokenBoundaryAtTextblock(parent, 517)).toBe(true);
    expect(parent.textBetween).toHaveBeenCalledWith(261, 517, '\0', '\0');
  });

  it('repositions the caret overlay when editor geometry changes', () => {
    const animationFrames: FrameRequestCallback[] = [];
    const animationFrame = vi.fn((callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(animationFrame);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(vi.fn());
    vi.stubGlobal('ResizeObserver', TestResizeObserver);

    const editorDom = document.createElement('div');
    document.body.appendChild(editorDom);

    let top = 12;
    const view = {
      dom: editorDom,
      composing: false,
      hasFocus: () => true,
      coordsAtPos: vi.fn(() => ({
        left: 24,
        top,
        bottom: top + 20,
      })),
      domAtPos: vi.fn(),
      state: {
        selection: createTextblockSelection(),
      },
    };

    const overlay = new TextBlockCaretOverlayView(view as any);
    animationFrames.shift()?.(0);
    const caret = document.querySelector<HTMLElement>('.editor-textblock-caret-overlay');

    expect(TestResizeObserver.instances).toHaveLength(1);
    expect(TestResizeObserver.instances[0]!.observe).toHaveBeenCalledWith(editorDom);
    expect(caret?.style.top).toBe('12px');

    top = 48;
    TestResizeObserver.instances[0]!.callback([], TestResizeObserver.instances[0] as unknown as ResizeObserver);
    animationFrames.shift()?.(0);

    expect(view.coordsAtPos).toHaveBeenCalledTimes(2);
    expect(caret?.style.top).toBe('48px');

    overlay.destroy();
    expect(TestResizeObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });
});
