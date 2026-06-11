import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  createTextEditorViewSession,
  type TextEditorSessionRefs,
  type TextEditorSessionState,
} from './textEditorViewSession';

interface TestState extends TextEditorSessionState {
  value: string;
}

interface TestRefs extends TextEditorSessionRefs {
  draftValue: string;
  initialValue: string;
}

function createSessionHarness(args?: { previewInputDebounceMs?: number }) {
  const editorDom = document.createElement('div');
  document.body.appendChild(editorDom);
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);

  let state: TestState = {
    isOpen: true,
    nodePos: 3,
    position: { x: 10, y: 20 },
    value: 'initial',
  };
  const refs: TestRefs = {
    textareaElement: null,
    draftValue: '',
    initialValue: '',
  };
  const previewInput = vi.fn();
  const previewCancel = vi.fn();
  const cancelSession = vi.fn();
  const saveSession = vi.fn();
  const session = createTextEditorViewSession<TestState, TestRefs>({
    editorView: {
      dom: editorDom,
      nodeDOM: () => anchor,
    } as unknown as EditorView,
    onOutsideCloseIntent: vi.fn(),
    refs,
    popupClassName: 'text-editor-popup-test',
    placeholder: 'Type',
    getEditorState: () => state,
    getStateRenderKey: (nextState) => String(nextState.nodePos),
    getValue: (nextState) => nextState.value,
    setInitialValue: (nextRefs, value) => {
      nextRefs.initialValue = value;
    },
    setDraftValue: (nextRefs, value) => {
      nextRefs.draftValue = value;
    },
    getInitialValue: (nextRefs) => nextRefs.initialValue,
    resetRefs: (nextRefs) => {
      nextRefs.initialValue = '';
      nextRefs.draftValue = '';
    },
    resolveAnchorElement: () => anchor,
    getAnchorViewportPosition: () => ({ x: 10, y: 20 }),
    previewInput,
    previewInputDebounceMs: args?.previewInputDebounceMs ?? 25,
    previewCancel,
    cancelSession,
    saveSession,
  });

  return {
    anchor,
    cancelSession,
    editorDom,
    previewCancel,
    previewInput,
    refs,
    saveSession,
    session,
    setState(nextState: Partial<TestState>) {
      state = { ...state, ...nextState };
    },
  };
}

function typeInTextarea(textarea: HTMLTextAreaElement, value: string) {
  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function stubPopupGeometry(args: {
  card: HTMLElement;
  textarea: HTMLTextAreaElement;
  cardHeight: number;
  textareaHeight: number;
  scrollHeight: number;
}) {
  const { card, textarea, cardHeight, textareaHeight, scrollHeight } = args;

  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 600,
    top: 100,
    bottom: 100 + cardHeight,
    width: 600,
    height: cardHeight,
    x: 0,
    y: 100,
    toJSON: () => ({}),
  });
  vi.spyOn(textarea, 'getBoundingClientRect').mockReturnValue({
    left: 16,
    right: 584,
    top: 116,
    bottom: 116 + textareaHeight,
    width: 568,
    height: textareaHeight,
    x: 16,
    y: 116,
    toJSON: () => ({}),
  });
  Object.defineProperty(textarea, 'scrollHeight', {
    value: scrollHeight,
    configurable: true,
  });
}

describe('createTextEditorViewSession', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('debounces live preview input and only renders the latest draft', () => {
    vi.useFakeTimers();
    const { previewInput, refs, session } = createSessionHarness();

    session.update();
    expect(refs.textareaElement).toBeInstanceOf(HTMLTextAreaElement);
    const textarea = refs.textareaElement!;

    typeInTextarea(textarea, 'first');
    typeInTextarea(textarea, 'second');

    expect(refs.draftValue).toBe('second');
    expect(previewInput).not.toHaveBeenCalled();

    vi.advanceTimersByTime(24);
    expect(previewInput).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(previewInput).toHaveBeenCalledTimes(1);
    expect(previewInput).toHaveBeenLastCalledWith(expect.objectContaining({
      value: 'second',
    }));

    session.destroy();
  });

  it('writes resolved popup width variables onto the popup container', () => {
    vi.stubGlobal('innerWidth', 1280);
    const { editorDom, session } = createSessionHarness();
    vi.spyOn(editorDom, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 740,
      top: 0,
      bottom: 400,
      width: 640,
      height: 400,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    });

    session.update();

    const popup = document.querySelector<HTMLElement>('.text-editor-popup-test')!;
    expect(popup.style.getPropertyValue('--vlaina-text-editor-popup-width')).toBe('640px');
    expect(popup.style.getPropertyValue('--vlaina-math-editor-width')).toBe('640px');
    expect(popup.style.getPropertyValue('--vlaina-width-math-editor')).toBe('640px');
    expect(popup.style.getPropertyValue('--vlaina-width-math-editor-mobile')).toBe('640px');

    session.destroy();
  });

  it('focuses the popup textarea synchronously when the editor opens', () => {
    const { refs, session } = createSessionHarness();

    session.update();

    expect(document.activeElement).toBe(refs.textareaElement);

    session.destroy();
  });

  it('coalesces textarea autosize work to one animation frame while typing', () => {
    vi.stubGlobal('innerHeight', 500);
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const { refs, session } = createSessionHarness({ previewInputDebounceMs: 1_000 });

    session.update();
    const textarea = refs.textareaElement!;
    const card = document.querySelector<HTMLElement>('.text-editor-card')!;
    stubPopupGeometry({
      card,
      textarea,
      cardHeight: 180,
      textareaHeight: 100,
      scrollHeight: 240,
    });
    textarea.style.height = '120px';

    typeInTextarea(textarea, 'first');
    typeInTextarea(textarea, 'second');

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(textarea.style.height).toBe('120px');

    frameCallbacks[0]?.(0);

    expect(textarea.style.height).toBe('240px');

    session.destroy();
  });

  it('clears a pending preview when the session closes', () => {
    vi.useFakeTimers();
    const { previewInput, refs, session, setState } = createSessionHarness();

    session.update();
    typeInTextarea(refs.textareaElement!, 'pending');

    setState({ isOpen: false });
    session.update();
    vi.advanceTimersByTime(25);

    expect(previewInput).not.toHaveBeenCalled();

    session.destroy();
  });
});
