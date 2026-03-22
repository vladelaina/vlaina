import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useComposerClickFocus } from "./useComposerClickFocus";

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
      <button data-testid="message-button" type="button">
        action
      </button>
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

  it("does not focus composer when clicking interactive elements", () => {
    render(<TestHarness />);

    fireEvent.mouseDown(screen.getByTestId("message-button"), {
      button: 0,
      clientX: 20,
      clientY: 20,
    });

    expect(mocked.focusComposerInput).not.toHaveBeenCalled();
  });
});
