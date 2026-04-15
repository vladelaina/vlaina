import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import type { RefObject } from "react";
import { useChatShortcuts } from "./useChatShortcuts";

const mocked = vi.hoisted(() => ({
  toggleTemporaryChat: vi.fn(),
  createSession: vi.fn(),
  openNewChat: vi.fn(),
  switchSession: vi.fn(),
  getState: vi.fn(),
  getUIState: vi.fn(),
  writeText: vi.fn(),
  dispatchChatMessageCopied: vi.fn(),
  isComposerFocusTarget: vi.fn(),
  selectComposerInputAll: vi.fn(),
}));

vi.mock("@/stores/useAIStore", () => ({
  actions: {
    toggleTemporaryChat: mocked.toggleTemporaryChat,
    createSession: mocked.createSession,
    openNewChat: mocked.openNewChat,
    switchSession: mocked.switchSession,
  },
}));

vi.mock("@/stores/unified/useUnifiedStore", () => ({
  useUnifiedStore: {
    getState: mocked.getState,
  },
}));

vi.mock("@/stores/ai/chatState", () => ({
  useAIUIStore: {
    getState: mocked.getUIState,
  },
}));

vi.mock("@/components/Chat/common/copyFeedback", () => ({
  dispatchChatMessageCopied: mocked.dispatchChatMessageCopied,
}));

vi.mock("@/lib/ui/composerFocusRegistry", () => ({
  isComposerFocusTarget: mocked.isComposerFocusTarget,
  selectComposerInputAll: mocked.selectComposerInputAll,
}));

function TestHarness({
  onFocusInput,
  onToggleShortcuts,
  onStopGeneration,
  isGenerating = false,
  scrollRef,
  enabled = true,
}: {
  onFocusInput: () => void;
  onToggleShortcuts: () => void;
  onStopGeneration?: () => void;
  isGenerating?: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  enabled?: boolean;
}) {
  useChatShortcuts({ onFocusInput, onToggleShortcuts, onStopGeneration, isGenerating, scrollRef }, enabled);
  return null;
}

function fireKeydown(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(event);
  return event;
}

function createState(overrides?: any) {
  return {
    data: {
      ai: {
        messages: {
          "session-1": [{ id: "m1", role: "user", content: "hello" }],
        },
        sessions: [
          { id: "session-1", updatedAt: 20 },
          { id: "session-2", updatedAt: 10 },
        ],
        ...overrides,
      },
    },
  };
}

function createUIState(overrides?: any) {
  return {
    temporaryChatEnabled: false,
    currentSessionId: "session-1",
    ...overrides,
  };
}

function setup(options?: {
  state?: any;
  uiState?: any;
  isGenerating?: boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
  enabled?: boolean;
}) {
  const onFocusInput = vi.fn();
  const onToggleShortcuts = vi.fn();
  const onStopGeneration = vi.fn();
  const scrollRef = options?.scrollRef ?? ({ current: null } as RefObject<HTMLDivElement | null>);
  mocked.getState.mockReturnValue(options?.state ?? createState());
  mocked.getUIState.mockReturnValue(options?.uiState ?? createUIState());

  const rendered = render(
    <TestHarness
      onFocusInput={onFocusInput}
      onToggleShortcuts={onToggleShortcuts}
      onStopGeneration={onStopGeneration}
      isGenerating={options?.isGenerating ?? false}
      scrollRef={scrollRef}
      enabled={options?.enabled}
    />,
  );

  return { ...rendered, onFocusInput, onToggleShortcuts, onStopGeneration, scrollRef };
}

describe("useChatShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getState.mockReturnValue(createState());
    mocked.getUIState.mockReturnValue(createUIState());
    mocked.isComposerFocusTarget.mockReturnValue(false);
    mocked.selectComposerInputAll.mockReturnValue(true);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mocked.writeText },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("intercepts Ctrl+J to block browser default behavior", () => {
    setup();

    const event = fireKeydown({ key: "j", ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(mocked.getState).not.toHaveBeenCalled();
    expect(mocked.toggleTemporaryChat).not.toHaveBeenCalled();
    expect(mocked.createSession).not.toHaveBeenCalled();
  });

  it("handles Ctrl+/ to open shortcuts dialog", () => {
    const { onToggleShortcuts } = setup();

    const event = fireKeydown({ key: "/", ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(onToggleShortcuts).toHaveBeenCalledTimes(1);
  });

  it("handles Shift+Escape to focus input", () => {
    const { onFocusInput } = setup();

    const event = fireKeydown({ key: "Escape", shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(onFocusInput).toHaveBeenCalledTimes(1);
  });

  it("stops the current response on Escape while generating", () => {
    const { onStopGeneration } = setup({ isGenerating: true });

    const event = fireKeydown({ key: "Escape" });

    expect(event.defaultPrevented).toBe(true);
    expect(onStopGeneration).toHaveBeenCalledTimes(1);
  });

  it("does not intercept Escape inside a dialog", () => {
    const { onStopGeneration } = setup({ isGenerating: true });

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const button = document.createElement("button");
    dialog.appendChild(button);
    document.body.appendChild(dialog);

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(onStopGeneration).not.toHaveBeenCalled();
  });

  it("intercepts Ctrl+A to select composer content instead of selecting page text", () => {
    const { onFocusInput } = setup();

    const event = fireKeydown({ key: "a", ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(mocked.selectComposerInputAll).toHaveBeenCalledTimes(1);
    expect(onFocusInput).not.toHaveBeenCalled();
  });

  it("opens temporary chat on Ctrl+Shift+J when temporary mode is disabled", () => {
    const { onFocusInput } = setup({
      state: createState(),
      uiState: createUIState({ temporaryChatEnabled: false }),
    });

    const event = fireKeydown({ key: "j", ctrlKey: true, shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(mocked.toggleTemporaryChat).toHaveBeenCalledWith(true);
    expect(mocked.createSession).not.toHaveBeenCalled();
    expect(onFocusInput).toHaveBeenCalledTimes(1);
  });

  it("exits temporary chat to a blank normal draft on Ctrl+Shift+J when current temporary chat is empty", () => {
    const { onFocusInput } = setup({
      state: createState({
        messages: { "temp-1": [] },
      }),
      uiState: createUIState({
        temporaryChatEnabled: true,
        currentSessionId: "temp-1",
      }),
    });

    fireKeydown({ key: "j", ctrlKey: true, shiftKey: true });

    expect(mocked.openNewChat).toHaveBeenCalledTimes(1);
    expect(mocked.toggleTemporaryChat).not.toHaveBeenCalled();
    expect(mocked.createSession).not.toHaveBeenCalled();
    expect(onFocusInput).toHaveBeenCalledTimes(1);
  });

  it("creates a fresh temporary chat on Ctrl+Shift+J when current temporary chat is not empty", () => {
    const { onFocusInput } = setup({
      state: createState({
        messages: { "temp-1": [{ id: "x", role: "user", content: "occupied" }] },
      }),
      uiState: createUIState({
        temporaryChatEnabled: true,
        currentSessionId: "temp-1",
      }),
    });

    fireKeydown({ key: "j", ctrlKey: true, shiftKey: true });

    expect(mocked.createSession).toHaveBeenCalledWith("New Chat");
    expect(mocked.toggleTemporaryChat).not.toHaveBeenCalled();
    expect(onFocusInput).toHaveBeenCalledTimes(1);
  });

  it("handles Ctrl+Shift+O to open a new normal chat", () => {
    const { onFocusInput } = setup();

    const event = fireKeydown({ key: "o", ctrlKey: true, shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(mocked.openNewChat).toHaveBeenCalledTimes(1);
    expect(onFocusInput).toHaveBeenCalledTimes(1);
  });

  it("copies last assistant response without think content on Ctrl+Shift+C", async () => {
    setup({
      state: createState({
        messages: {
          "session-1": [
            { id: "u1", role: "user", content: "ask" },
            { id: "a1", role: "assistant", content: "Visible<think>hidden</think> answer" },
          ],
        },
      }),
    });

    const event = fireKeydown({ key: "c", ctrlKey: true, shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(mocked.writeText).toHaveBeenCalledWith("Visible answer");
    await waitFor(() => {
      expect(mocked.dispatchChatMessageCopied).toHaveBeenCalledWith("a1");
    });
  });

  it("navigates to previous user message with Shift+ArrowUp", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "scrollTop", {
      value: 300,
      writable: true,
      configurable: true,
    });
    const scrollToMock = vi.fn();
    Object.defineProperty(container, "scrollTo", {
      value: scrollToMock,
      configurable: true,
    });

    const user1 = document.createElement("div");
    user1.setAttribute("data-message-item", "true");
    user1.setAttribute("data-role", "user");
    Object.defineProperty(user1, "offsetTop", { value: 100, configurable: true });

    const user2 = document.createElement("div");
    user2.setAttribute("data-message-item", "true");
    user2.setAttribute("data-role", "user");
    Object.defineProperty(user2, "offsetTop", { value: 250, configurable: true });

    const user3 = document.createElement("div");
    user3.setAttribute("data-message-item", "true");
    user3.setAttribute("data-role", "user");
    Object.defineProperty(user3, "offsetTop", { value: 420, configurable: true });

    container.append(user1, user2, user3);

    const scrollRef = { current: container } as RefObject<HTMLDivElement | null>;
    setup({ scrollRef });

    const event = fireKeydown({ key: "ArrowUp", shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(scrollToMock).toHaveBeenCalledWith({ top: 230, behavior: "smooth" });
    expect(mocked.getState).not.toHaveBeenCalled();
  });

  it("does nothing when shortcuts are disabled", () => {
    const { onToggleShortcuts, onFocusInput } = setup({ enabled: false });

    const event = fireKeydown({ key: "/", ctrlKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(onToggleShortcuts).not.toHaveBeenCalled();
    expect(onFocusInput).not.toHaveBeenCalled();
  });
});
