import { act } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ChatMessage } from "@/lib/ai/types";

vi.mock("@/components/Chat/features/Markdown/MarkdownRenderer", () => ({
  default: ({
    content,
    copiedCodeBlockId,
    onCopyCodeBlock,
  }: {
    content: string;
    copiedCodeBlockId?: string | null;
    onCopyCodeBlock?: (blockId: string) => void;
  }) => (
    <div
      data-testid="markdown"
      data-content={content}
      data-copied-code-block-id={copiedCodeBlockId ?? ""}
    >
      {content}
      <button onClick={() => onCopyCodeBlock?.("m1:0")}>copy-code-block</button>
    </div>
  ),
}));

vi.mock("./MessageToolbar", () => ({
  MessageToolbar: () => <div data-testid="toolbar">toolbar</div>,
}));

vi.mock("./ErrorBlock", () => ({
  ErrorBlock: ({ content }: { content: string }) => <div data-testid="error">{content}</div>,
}));

import { AIMessage } from "./AIMessage";

function createMessage(content: string): ChatMessage {
  const timestamp = Date.now();
  return {
    id: "m1",
    role: "assistant",
    content,
    modelId: "model-a",
    timestamp,
    versions: [{ content, createdAt: timestamp, subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

describe("AIMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it("shows inline loading dots when streaming content is already visible", () => {
    render(
      <AIMessage
        msg={createMessage("Processing image...")}
        imageGallery={[]}
        isLoading
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(document.querySelectorAll(".vlaina-dot").length).toBe(3);
  });

  it("does not show inline loading dots when content is empty", () => {
    render(
      <AIMessage
        msg={createMessage("")}
        imageGallery={[]}
        isLoading
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(document.querySelectorAll(".vlaina-dot").length).toBe(0);
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
  });

  it("strips error tags from markdown content and renders the parsed error block", () => {
    render(
      <AIMessage
        msg={createMessage('Visible<error type="NETWORK_ERROR" code="503">Request failed</error>')}
        imageGallery={[]}
        isLoading={false}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(screen.getByTestId("markdown")).toHaveAttribute("data-content", "Visible");
    expect(screen.getByTestId("error")).toHaveTextContent("Request failed");
  });

  it("stores copied code block feedback above the markdown renderer", () => {
    render(
      <AIMessage
        msg={createMessage("```ts\nconst a = 1;\n```")}
        imageGallery={[]}
        isLoading={false}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "copy-code-block" }));
    });

    expect(screen.getByTestId("markdown")).toHaveAttribute("data-copied-code-block-id", "m1:0");
  });

  it("clears copied code block feedback after the timeout", () => {
    render(
      <AIMessage
        msg={createMessage("```ts\nconst a = 1;\n```")}
        imageGallery={[]}
        isLoading={false}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "copy-code-block" }));
    });
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByTestId("markdown")).toHaveAttribute("data-copied-code-block-id", "");
  });

  it("resets copied code block feedback when the message changes", () => {
    const { rerender } = render(
      <AIMessage
        msg={createMessage("```ts\nconst a = 1;\n```")}
        imageGallery={[]}
        isLoading={false}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "copy-code-block" }));
    });
    expect(screen.getByTestId("markdown")).toHaveAttribute("data-copied-code-block-id", "m1:0");

    rerender(
      <AIMessage
        msg={{
          ...createMessage("Next"),
          id: "m2",
        }}
        imageGallery={[]}
        isLoading={false}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(screen.getByTestId("markdown")).toHaveAttribute("data-copied-code-block-id", "");
  });
});
