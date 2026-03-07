import { createContext, type ComponentProps, type ReactNode, useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatSidebar } from "./ChatSidebar";

const closeAutoFocusContext = createContext<((event: Event) => void) | null>(null);

const mocked = vi.hoisted(() => ({
  useAIStore: vi.fn(),
  updateSession: vi.fn(),
  switchSession: vi.fn(),
  markSessionRead: vi.fn(),
}));

vi.mock("@/stores/useAIStore", () => ({
  useAIStore: mocked.useAIStore,
}));

vi.mock("@/components/common/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));

vi.mock("@/components/common/DeleteIcon", () => ({
  DeleteIcon: () => <span>delete</span>,
}));

vi.mock("@/components/ui/icons", () => ({
  Icon: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, ...props }: ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuContent: ({
    children,
    onCloseAutoFocus,
  }: {
    children: ReactNode;
    onCloseAutoFocus?: (event: Event) => void;
  }) => (
    <closeAutoFocusContext.Provider value={onCloseAutoFocus ?? null}>
      <div>{children}</div>
    </closeAutoFocusContext.Provider>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
    onClick,
    ...props
  }: ComponentProps<"button"> & {
    onSelect?: (event: Event) => void;
  }) => {
    const closeHandler = useContext(closeAutoFocusContext);

    return (
      <button
        type="button"
        {...props}
        onClick={(event) => {
          onSelect?.(event.nativeEvent);
          onClick?.(event);
          if (closeHandler) {
            closeHandler(
              new Event("close", {
                bubbles: false,
                cancelable: true,
              })
            );
          }
        }}
      >
        {children}
      </button>
    );
  },
  DropdownMenuSeparator: () => <div data-testid="menu-separator" />,
}));

function createStore() {
  return {
    sessions: [
      {
        id: "session-1",
        title: "Markdown Sample",
        updatedAt: Date.now(),
        isPinned: false,
      },
    ],
    currentSessionId: "session-1",
    openNewChat: vi.fn(),
    switchSession: mocked.switchSession,
    deleteSession: vi.fn(),
    updateSession: mocked.updateSession,
    isSessionLoading: vi.fn(() => false),
    isSessionUnread: vi.fn(() => false),
    markSessionRead: mocked.markSessionRead,
  };
}

describe("ChatSidebar rename", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.useAIStore.mockReturnValue(createStore());
  });

  it("keeps inline rename editable after cancel and reopen", async () => {
    render(<ChatSidebar />);

    fireEvent.click(screen.getByRole("button", { name: /Rename/ }));

    const firstInput = await screen.findByDisplayValue("Markdown Sample");
    await waitFor(() => {
      expect(firstInput).toHaveFocus();
    });
    expect((firstInput as HTMLInputElement).selectionStart).toBe(0);
    expect((firstInput as HTMLInputElement).selectionEnd).toBe("Markdown Sample".length);

    fireEvent.blur(firstInput);
    expect(mocked.updateSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Rename/ }));

    const secondInput = await screen.findByDisplayValue("Markdown Sample");
    await waitFor(() => {
      expect(secondInput).toHaveFocus();
    });
    expect((secondInput as HTMLInputElement).selectionStart).toBe(0);
    expect((secondInput as HTMLInputElement).selectionEnd).toBe("Markdown Sample".length);
  });

  it("commits rename on Enter", async () => {
    render(<ChatSidebar />);

    fireEvent.click(screen.getByRole("button", { name: /Rename/ }));

    const input = await screen.findByDisplayValue("Markdown Sample");
    fireEvent.change(input, { target: { value: "Renamed Session" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mocked.updateSession).toHaveBeenCalledTimes(1);
    expect(mocked.updateSession).toHaveBeenCalledWith("session-1", { title: "Renamed Session" });
  });
});
