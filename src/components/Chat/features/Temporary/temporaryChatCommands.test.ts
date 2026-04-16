import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  runOpenNewChatShortcut,
  runTemporaryChatWelcomeShortcut,
} from "./temporaryChatCommands";

const mocked = vi.hoisted(() => ({
  toggleTemporaryChat: vi.fn(),
  createSession: vi.fn(),
  openNewChat: vi.fn(),
  getState: vi.fn(),
  getUIState: vi.fn(),
}));

vi.mock("@/stores/useAIStore", () => ({
  actions: {
    toggleTemporaryChat: mocked.toggleTemporaryChat,
    createSession: mocked.createSession,
    openNewChat: mocked.openNewChat,
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

function createState(overrides?: any) {
  return {
    data: {
      ai: {
        messages: {
          "session-1": [{ id: "m1", role: "user", content: "hello" }],
        },
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

describe("temporaryChatCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getState.mockReturnValue(createState());
    mocked.getUIState.mockReturnValue(createUIState());
  });

  it("opens a regular new chat", () => {
    runOpenNewChatShortcut();

    expect(mocked.openNewChat).toHaveBeenCalledTimes(1);
  });

  it("enables temporary chat when it is currently disabled", () => {
    runTemporaryChatWelcomeShortcut();

    expect(mocked.toggleTemporaryChat).toHaveBeenCalledWith(true);
    expect(mocked.openNewChat).not.toHaveBeenCalled();
    expect(mocked.createSession).not.toHaveBeenCalled();
  });

  it("returns to a blank regular chat when the current temporary chat is empty", () => {
    mocked.getState.mockReturnValue(
      createState({
        messages: { "temp-1": [] },
      }),
    );
    mocked.getUIState.mockReturnValue(
      createUIState({
        temporaryChatEnabled: true,
        currentSessionId: "temp-1",
      }),
    );

    runTemporaryChatWelcomeShortcut();

    expect(mocked.openNewChat).toHaveBeenCalledTimes(1);
    expect(mocked.toggleTemporaryChat).not.toHaveBeenCalled();
    expect(mocked.createSession).not.toHaveBeenCalled();
  });

  it("creates a fresh temporary chat when the current temporary chat already has content", () => {
    mocked.getState.mockReturnValue(
      createState({
        messages: { "temp-1": [{ id: "m1", role: "user", content: "occupied" }] },
      }),
    );
    mocked.getUIState.mockReturnValue(
      createUIState({
        temporaryChatEnabled: true,
        currentSessionId: "temp-1",
      }),
    );

    runTemporaryChatWelcomeShortcut();

    expect(mocked.createSession).toHaveBeenCalledWith("New Chat");
    expect(mocked.toggleTemporaryChat).not.toHaveBeenCalled();
    expect(mocked.openNewChat).not.toHaveBeenCalled();
  });
});
