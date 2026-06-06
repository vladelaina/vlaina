import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  isPointInsideReadableText,
  MAX_CHAT_READABLE_TEXT_HIT_CHARS,
  useComposerClickFocus,
} from "./useComposerClickFocus";

const mocked = vi.hoisted(() => ({
  focusComposerInput: vi.fn(),
  isComposerFocusTarget: vi.fn(),
}));

vi.mock("@/lib/ui/composerFocusRegistry", () => ({
  focusComposerInput: mocked.focusComposerInput,
  isComposerFocusTarget: mocked.isComposerFocusTarget,
}));

function TestHarness() {
  const requestFocusFallback = vi.fn();
  const handleMouseDownCapture = useComposerClickFocus({ requestFocusFallback });

  return (
    <div onMouseDownCapture={handleMouseDownCapture}>
      <div data-testid="message-blank" data-message-item="true">
        <div data-testid="message-blank-inner"> </div>
      </div>
      <div data-message-item="true">
        <p data-testid="message-text">hello</p>
      </div>
      <div data-message-item="true" data-chat-selection-surface="true">
        <p data-testid="assistant-paragraph">assistant answer</p>
      </div>
      <button data-testid="message-button" type="button">
        action
      </button>
      <div contentEditable="plaintext-only" data-testid="plaintext-editor" suppressContentEditableWarning>
        editable
      </div>
    </div>
  );
}

describe("useComposerClickFocus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.focusComposerInput.mockReturnValue(true);
    mocked.isComposerFocusTarget.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  it("focuses composer when clicking blank space inside a message row", () => {
    render(<TestHarness />);

    fireEvent.mouseDown(screen.getByTestId("message-blank-inner"), {
      button: 0,
      clientX: 20,
      clientY: 20,
    });

    expect(mocked.focusComposerInput).toHaveBeenCalledTimes(1);
  });

  it("does not focus composer when clicking readable message content", () => {
    render(<TestHarness />);

    fireEvent.mouseDown(screen.getByTestId("message-text"), {
      button: 0,
      clientX: 20,
      clientY: 20,
    });

    expect(mocked.focusComposerInput).not.toHaveBeenCalled();
  });

  it("treats oversized readable content as a text hit without scanning text nodes", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "a".repeat(MAX_CHAT_READABLE_TEXT_HIT_CHARS + 1);
    const createTreeWalkerSpy = vi.spyOn(document, "createTreeWalker");

    expect(isPointInsideReadableText(paragraph, { clientX: 0, clientY: 0 })).toBe(true);
    expect(createTreeWalkerSpy).not.toHaveBeenCalled();

    createTreeWalkerSpy.mockRestore();
  });

  it("checks readable content rects without materializing the rect list", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "assistant answer";
    const rectIterator = vi.fn(() => {
      throw new Error("rects should not be iterated");
    });
    const createRangeSpy = vi.spyOn(document, "createRange").mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () => ({
        0: {
          left: 0,
          right: 40,
          top: 0,
          bottom: 24,
        },
        length: 1,
        [Symbol.iterator]: rectIterator,
      }) as unknown as DOMRectList,
      detach: vi.fn(),
    } as unknown as Range);

    expect(isPointInsideReadableText(paragraph, { clientX: 90, clientY: 12 })).toBe(false);
    expect(rectIterator).not.toHaveBeenCalled();

    createRangeSpy.mockRestore();
  });

  it("focuses composer when clicking blank space inside assistant readable content", () => {
    const createRangeSpy = vi.spyOn(document, "createRange").mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () => [
        {
          left: 0,
          right: 40,
          top: 0,
          bottom: 24,
        },
      ] as unknown as DOMRectList,
      detach: vi.fn(),
    } as unknown as Range);

    render(<TestHarness />);

    fireEvent.mouseDown(screen.getByTestId("assistant-paragraph"), {
      button: 0,
      clientX: 90,
      clientY: 12,
    });

    expect(mocked.focusComposerInput).toHaveBeenCalledTimes(1);
    createRangeSpy.mockRestore();
  });

  it("does not focus composer when clicking interactive elements", () => {
    render(<TestHarness />);

    fireEvent.mouseDown(screen.getByTestId("message-button"), {
      button: 0,
      clientX: 20,
      clientY: 20,
    });

    expect(mocked.focusComposerInput).not.toHaveBeenCalled();
  });

  it("does not focus composer when clicking plaintext-only editable content", () => {
    render(<TestHarness />);

    fireEvent.mouseDown(screen.getByTestId("plaintext-editor"), {
      button: 0,
      clientX: 20,
      clientY: 20,
    });

    expect(mocked.focusComposerInput).not.toHaveBeenCalled();
  });
});
