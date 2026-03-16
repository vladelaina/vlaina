import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ChatMessage } from "@/lib/ai/types";

vi.mock("@/components/Chat/features/Markdown/MarkdownRenderer", () => ({
  default: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}));

vi.mock("./MessageToolbar", () => ({
  MessageToolbar: () => <div data-testid="toolbar">toolbar</div>,
}));

vi.mock("./ErrorBlock", () => ({
  ErrorBlock: ({ content }: { content: string }) => <div data-testid="error">{content}</div>,
}));

import { AIMessage } from "./AIMessage";

function createMessage(content: string): ChatMessage {
  return {
    id: "m1",
    role: "assistant",
    content,
    modelId: "model-a",
    timestamp: Date.now(),
  };
}

describe("AIMessage", () => {
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

    expect(document.querySelectorAll(".nekotick-dot").length).toBe(3);
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

    expect(document.querySelectorAll(".nekotick-dot").length).toBe(0);
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
  });
});
