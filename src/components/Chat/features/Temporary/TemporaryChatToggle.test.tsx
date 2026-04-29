import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { TemporaryChatToggle } from "./TemporaryChatToggle";

const mocks = vi.hoisted(() => ({
  useUnifiedStore: vi.fn(),
  useAIUIStore: vi.fn(),
  promoteTemporarySession: vi.fn(),
  toggleTemporaryChat: vi.fn(),
  generateAutoTitle: vi.fn(),
}));

vi.mock("@/stores/useAIStore", () => ({
  actions: {
    promoteTemporarySession: (...args: unknown[]) => mocks.promoteTemporarySession(...args),
    toggleTemporaryChat: (...args: unknown[]) => mocks.toggleTemporaryChat(...args),
  },
}));

vi.mock("@/stores/unified/useUnifiedStore", () => ({
  useUnifiedStore: mocks.useUnifiedStore,
}));

vi.mock("@/stores/ai/chatState", () => ({
  useAIUIStore: mocks.useAIUIStore,
}));

vi.mock("@/hooks/useAutoTitle", () => ({
  useAutoTitle: () => ({
    generateAutoTitle: mocks.generateAutoTitle,
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/shortcut-keys", () => ({
  ShortcutKeys: ({ keys }: { keys: string[] }) => <span>{keys.join("+")}</span>,
}));

vi.mock("@/components/ui/icons", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

function createStore(overrides?: Record<string, unknown>) {
  return {
    data: {
      ai: {
        temporaryChatEnabled: true,
        currentSessionId: "temp-session-1",
        sessions: [
          {
            id: "temp-session-1",
            modelId: "model-1",
          },
        ],
        messages: {
          "temp-session-1": [
            {
              id: "u1",
              role: "user",
              content: "![image](asset://x)\n\nDraft an API design",
              modelId: "model-1",
              timestamp: 1,
            },
          ],
        },
        providers: [
          {
            id: "provider-1",
            enabled: true,
          },
        ],
        models: [
          {
            id: "model-1",
            apiModelId: "model-1",
            providerId: "provider-1",
          },
        ],
        selectedModelId: "model-1",
      },
    },
    generatingSessions: {},
    ...overrides,
  };
}

function createUIState(store: ReturnType<typeof createStore>, overrides?: Record<string, unknown>) {
  const ai = store.data.ai;
  return {
    generatingSessions: store.generatingSessions as Record<string, boolean>,
    currentSessionId: ai.currentSessionId,
    temporaryChatEnabled: ai.temporaryChatEnabled,
    ...overrides,
  };
}

describe("TemporaryChatToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("promotes temporary chat and triggers auto title generation in promote mode", () => {
    const store = createStore();
    const uiState = createUIState(store);
    mocks.promoteTemporarySession.mockReturnValue("session-123");
    mocks.useUnifiedStore.mockImplementation((selector: (state: typeof store) => unknown) => selector(store));
    mocks.useAIUIStore.mockImplementation((selector: (state: typeof uiState) => unknown) => selector(uiState));

    render(<TemporaryChatToggle mode="promote" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Save temporary chat as regular chat" }),
    );

    expect(mocks.promoteTemporarySession).toHaveBeenCalledTimes(1);
    expect(mocks.generateAutoTitle).toHaveBeenCalledWith(
      "session-123",
      "provider-1",
      "model-1",
    );
  });

  it("skips auto title generation when selected model is unavailable", () => {
    const store = createStore({
      data: {
        ai: {
          temporaryChatEnabled: true,
          currentSessionId: "temp-session-1",
          sessions: [],
          messages: {
            "temp-session-1": [],
          },
          providers: [],
          models: [],
          selectedModelId: null,
        },
      },
    });
    const uiState = createUIState(store);
    mocks.promoteTemporarySession.mockReturnValue("session-123");
    mocks.useUnifiedStore.mockImplementation((selector: (state: typeof store) => unknown) => selector(store));
    mocks.useAIUIStore.mockImplementation((selector: (state: typeof uiState) => unknown) => selector(uiState));

    render(<TemporaryChatToggle mode="promote" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Save temporary chat as regular chat" }),
    );

    expect(mocks.promoteTemporarySession).toHaveBeenCalledTimes(1);
    expect(mocks.generateAutoTitle).not.toHaveBeenCalled();
  });

  it("toggle mode enables temporary chat when currently disabled", () => {
    const store = createStore({
      data: {
        ai: {
          temporaryChatEnabled: false,
          currentSessionId: "session-1",
          messages: { "session-1": [] },
        },
      },
    });
    const uiState = createUIState(store);
    mocks.useUnifiedStore.mockImplementation((selector: (state: typeof store) => unknown) => selector(store));
    mocks.useAIUIStore.mockImplementation((selector: (state: typeof uiState) => unknown) => selector(uiState));

    render(<TemporaryChatToggle mode="toggle" />);
    fireEvent.click(screen.getByRole("button", { name: "Enable Temporary Chat" }));

    expect(mocks.toggleTemporaryChat).toHaveBeenCalledWith(true);
  });

  it("toggle mode disables temporary chat when no user message exists", () => {
    const store = createStore({
      data: {
        ai: {
          temporaryChatEnabled: true,
          currentSessionId: "temp-session-1",
          messages: { "temp-session-1": [] },
        },
      },
    });
    const uiState = createUIState(store);
    mocks.useUnifiedStore.mockImplementation((selector: (state: typeof store) => unknown) => selector(store));
    mocks.useAIUIStore.mockImplementation((selector: (state: typeof uiState) => unknown) => selector(uiState));

    render(<TemporaryChatToggle mode="toggle" />);
    fireEvent.click(screen.getByRole("button", { name: "Temporary Chat is On" }));

    expect(mocks.toggleTemporaryChat).toHaveBeenCalledWith(false);
  });

  it("uses UI selection state when persisted chat selection is stale", () => {
    const store = createStore({
      data: {
        ai: {
          temporaryChatEnabled: false,
          currentSessionId: "session-1",
          messages: {
            "session-1": [
              {
                id: "u1",
                role: "user",
                content: "Persisted session",
                timestamp: 1,
              },
            ],
            "temp-session-1": [],
          },
        },
      },
    });
    const uiState = createUIState(store, {
      currentSessionId: "temp-session-1",
      temporaryChatEnabled: true,
    });
    mocks.useUnifiedStore.mockImplementation((selector: (state: typeof store) => unknown) => selector(store));
    mocks.useAIUIStore.mockImplementation((selector: (state: typeof uiState) => unknown) => selector(uiState));

    render(<TemporaryChatToggle mode="toggle" />);
    fireEvent.click(screen.getByRole("button", { name: "Temporary Chat is On" }));

    expect(mocks.toggleTemporaryChat).toHaveBeenCalledWith(false);
  });

  it("toggle mode does not disable temporary chat when current temporary session already has user messages", () => {
    const store = createStore();
    const uiState = createUIState(store);
    mocks.useUnifiedStore.mockImplementation((selector: (state: typeof store) => unknown) => selector(store));
    mocks.useAIUIStore.mockImplementation((selector: (state: typeof uiState) => unknown) => selector(uiState));

    render(<TemporaryChatToggle mode="toggle" />);
    fireEvent.click(screen.getByRole("button", { name: "Temporary Chat is On" }));

    expect(mocks.toggleTemporaryChat).not.toHaveBeenCalled();
  });

  it("promote button is disabled while session is generating", () => {
    const store = createStore({
      generatingSessions: {
        "temp-session-1": true,
      },
    });
    const uiState = createUIState(store);
    mocks.useUnifiedStore.mockImplementation((selector: (state: typeof store) => unknown) => selector(store));
    mocks.useAIUIStore.mockImplementation((selector: (state: typeof uiState) => unknown) => selector(uiState));

    render(<TemporaryChatToggle mode="promote" />);
    const button = screen.getByRole("button", {
      name: "Save temporary chat as regular chat",
    });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(mocks.promoteTemporarySession).not.toHaveBeenCalled();
  });
});
