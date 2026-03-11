import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { TemporaryChatToggle } from "./TemporaryChatToggle";

const mocks = vi.hoisted(() => ({
  useAIStore: vi.fn(),
  generateAutoTitle: vi.fn(),
}));

vi.mock("@/stores/useAIStore", () => ({
  useAIStore: mocks.useAIStore,
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
    temporaryChatEnabled: true,
    toggleTemporaryChat: vi.fn(),
    promoteTemporarySession: vi.fn(),
    currentSessionId: "temp-session-1",
    sessions: [
      {
        id: "temp-session-1",
        modelId: "model-1",
      },
    ],
    getModel: vi.fn((id: string) =>
      id === "model-1"
        ? {
            id: "model-1",
            apiModelId: "model-1",
            providerId: "provider-1",
          }
        : undefined,
    ),
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
    selectedModel: {
      id: "model-1",
      apiModelId: "model-1",
      providerId: "provider-1",
    },
    isSessionLoading: vi.fn(() => false),
    ...overrides,
  };
}

describe("TemporaryChatToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("promotes temporary chat and triggers auto title generation in promote mode", () => {
    const store = createStore({
      promoteTemporarySession: vi.fn(() => "session-123"),
    });
    mocks.useAIStore.mockReturnValue(store);

    render(<TemporaryChatToggle mode="promote" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Save temporary chat as regular chat" }),
    );

    expect(store.promoteTemporarySession).toHaveBeenCalledTimes(1);
    expect(mocks.generateAutoTitle).toHaveBeenCalledWith(
      "session-123",
      "Draft an API design",
      "provider-1",
      "model-1",
    );
  });

  it("skips auto title generation when selected model is unavailable", () => {
    const store = createStore({
      selectedModel: undefined,
      sessions: [],
      getModel: vi.fn(() => undefined),
      promoteTemporarySession: vi.fn(() => "session-123"),
    });
    mocks.useAIStore.mockReturnValue(store);

    render(<TemporaryChatToggle mode="promote" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Save temporary chat as regular chat" }),
    );

    expect(store.promoteTemporarySession).toHaveBeenCalledTimes(1);
    expect(mocks.generateAutoTitle).not.toHaveBeenCalled();
  });

  it("toggle mode enables temporary chat when currently disabled", () => {
    const store = createStore({
      temporaryChatEnabled: false,
      currentSessionId: "session-1",
      messages: { "session-1": [] },
    });
    mocks.useAIStore.mockReturnValue(store);

    render(<TemporaryChatToggle mode="toggle" />);
    fireEvent.click(screen.getByRole("button", { name: "Enable Temporary Chat" }));

    expect(store.toggleTemporaryChat).toHaveBeenCalledWith(true);
  });

  it("toggle mode disables temporary chat when no user message exists", () => {
    const store = createStore({
      messages: { "temp-session-1": [] },
    });
    mocks.useAIStore.mockReturnValue(store);

    render(<TemporaryChatToggle mode="toggle" />);
    fireEvent.click(screen.getByRole("button", { name: "Temporary Chat is On" }));

    expect(store.toggleTemporaryChat).toHaveBeenCalledWith(false);
  });

  it("toggle mode does not disable temporary chat when current temporary session already has user messages", () => {
    const store = createStore();
    mocks.useAIStore.mockReturnValue(store);

    render(<TemporaryChatToggle mode="toggle" />);
    fireEvent.click(screen.getByRole("button", { name: "Temporary Chat is On" }));

    expect(store.toggleTemporaryChat).not.toHaveBeenCalled();
  });

  it("promote button is disabled while session is generating", () => {
    const store = createStore({
      isSessionLoading: vi.fn(() => true),
    });
    mocks.useAIStore.mockReturnValue(store);

    render(<TemporaryChatToggle mode="promote" />);
    const button = screen.getByRole("button", {
      name: "Save temporary chat as regular chat",
    });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(store.promoteTemporarySession).not.toHaveBeenCalled();
  });
});
