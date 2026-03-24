import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { writeTextMock } = vi.hoisted(() => ({
  writeTextMock: vi.fn(),
}));

vi.mock("@/components/ui/icons", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

import CopyButton from "./CopyButton";

describe("CopyButton", () => {
  beforeEach(() => {
    writeTextMock.mockReset();
    writeTextMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("copies on pointer down and suppresses the following click", async () => {
    const onCopy = vi.fn().mockResolvedValue(undefined);

    render(<CopyButton content="const a = 1;" onCopy={onCopy} />);

    const button = screen.getByRole("button");
    fireEvent.pointerDown(button, { button: 0 });
    fireEvent.click(button);

    await waitFor(() => {
      expect(onCopy).toHaveBeenCalledTimes(1);
    });
    expect(onCopy).toHaveBeenCalledWith("const a = 1;");
  });

  it("falls back to navigator clipboard on click when no custom handler is provided", async () => {
    render(<CopyButton content="const b = 2;" />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("const b = 2;");
    });
  });

  it("renders controlled copied feedback", () => {
    render(<CopyButton content="const c = 3;" copied showLabels />);

    expect(screen.getByRole("button")).toHaveAttribute("title", "Copied!");
    expect(screen.getByTestId("icon-common.check")).toBeInTheDocument();
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("shows optimistic copied feedback after a successful custom copy", async () => {
    vi.useFakeTimers();
    const onCopy = vi.fn().mockResolvedValue(undefined);

    render(<CopyButton content="const d = 4;" onCopy={onCopy} showLabels />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onCopy).toHaveBeenCalledWith("const d = 4;");
    expect(screen.getByRole("button")).toHaveAttribute("title", "Copied!");
    expect(screen.getByText("Copied")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(screen.getByRole("button")).toHaveAttribute("title", "Copy to clipboard");
  });
});
