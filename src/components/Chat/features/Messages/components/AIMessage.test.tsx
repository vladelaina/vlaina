import { act } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ChatMessage } from "@/lib/ai/types";

vi.mock("@/components/Chat/features/Markdown/MarkdownRenderer", () => ({
  default: ({
    content,
    copiedCodeBlockId,
    onCopyCodeBlock,
    isStreaming,
    startTime,
    suspendStreamAnimation,
  }: {
    content: string;
    copiedCodeBlockId?: string | null;
    onCopyCodeBlock?: (blockId: string) => void;
    isStreaming?: boolean;
    startTime?: Date;
    suspendStreamAnimation?: boolean;
  }) => (
    <div
      data-testid="markdown"
      data-content={content}
      data-copied-code-block-id={copiedCodeBlockId ?? ""}
      data-streaming={String(Boolean(isStreaming))}
      data-start-time={startTime?.toISOString() ?? ""}
      data-suspend-stream-animation={String(Boolean(suspendStreamAnimation))}
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
  ErrorBlock: ({
    content,
    showLoginPrompt,
  }: {
    content: string;
    showLoginPrompt?: boolean;
  }) => (
    <div data-testid="error" data-login-prompt={String(Boolean(showLoginPrompt))}>
      {content}
    </div>
  ),
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

  it("does not show inline loading dots when streaming content is already visible", () => {
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

    expect(document.querySelectorAll(".vlaina-dot").length).toBe(0);
    expect(screen.getByTestId("markdown")).toHaveAttribute("data-streaming", "true");
  });

  it("does not show inline loading dots when streaming content is empty", () => {
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
    expect(screen.getByTestId("markdown")).toHaveAttribute("data-streaming", "false");
  });

  it("keeps the markdown transition idle when the message is not loading", () => {
    render(
      <AIMessage
        msg={createMessage("Done")}
        imageGallery={[]}
        isLoading={false}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(screen.getByTestId("markdown")).toHaveAttribute("data-streaming", "false");
  });

  it("passes through visible streaming text immediately", () => {
    render(
      <AIMessage
        msg={createMessage("Hello world")}
        imageGallery={[]}
        isLoading
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(screen.getByTestId("markdown")).toHaveAttribute("data-content", "Hello world");
  });

  it("starts visible stream animation when content first appears instead of at message creation", () => {
    const timestamp = Date.UTC(2026, 4, 11, 6, 0, 0);
    vi.setSystemTime(new Date("2026-05-11T06:00:03.000Z"));

    render(
      <AIMessage
        msg={{ ...createMessage("Hello world"), id: "m-first-visible", timestamp }}
        imageGallery={[]}
        isLoading
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(screen.getByTestId("markdown")).toHaveAttribute(
      "data-start-time",
      "2026-05-11T06:00:03.000Z",
    );
  });

  it("preserves the visible stream animation start time across remounts", () => {
    const timestamp = Date.UTC(2026, 4, 11, 6, 0, 0);
    const msg = { ...createMessage("Hello world"), id: "m-remount", timestamp };
    vi.setSystemTime(new Date("2026-05-11T06:00:03.000Z"));

    const view = render(
      <AIMessage
        msg={msg}
        imageGallery={[]}
        isLoading
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(screen.getByTestId("markdown")).toHaveAttribute(
      "data-start-time",
      "2026-05-11T06:00:03.000Z",
    );

    view.unmount();
    vi.setSystemTime(new Date("2026-05-11T06:00:06.000Z"));

    render(
      <AIMessage
        msg={msg}
        imageGallery={[]}
        isLoading
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(screen.getByTestId("markdown")).toHaveAttribute(
      "data-start-time",
      "2026-05-11T06:00:03.000Z",
    );
  });

  it("passes stream animation suspension to the markdown renderer", () => {
    render(
      <AIMessage
        msg={createMessage("Hello world")}
        imageGallery={[]}
        isLoading
        suspendStreamAnimation
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(screen.getByTestId("markdown")).toHaveAttribute("data-suspend-stream-animation", "true");
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

  it("shows the managed model auth prompt without the assistant toolbar", () => {
    render(
      <AIMessage
        msg={{
          ...createMessage('<error type="AUTH_ERROR" code="401">Sign in required</error>'),
          modelId: "vlaina-managed::gpt-test",
        }}
        imageGallery={[]}
        isLoading={false}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(screen.getByTestId("error")).toHaveAttribute("data-login-prompt", "true");
    expect(screen.queryByTestId("toolbar")).not.toBeInTheDocument();
  });

  it("keeps the normal error block and toolbar for non-managed auth errors", () => {
    render(
      <AIMessage
        msg={{
          ...createMessage('<error type="AUTH_ERROR" code="401">Invalid API key</error>'),
          modelId: "provider-1::gpt-test",
        }}
        imageGallery={[]}
        isLoading={false}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(screen.getByTestId("error")).toHaveAttribute("data-login-prompt", "false");
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
  });

  it("keeps web search results visible after sources are read", () => {
    const content = [
      '<web-search-status>{"phase":"results","query":"react","results":[{"title":"React Docs","url":"https://react.dev","snippet":"Official docs","publishedAt":null}]}</web-search-status>',
      '<web-search-status>{"phase":"complete","urls":["https://react.dev"],"failedSources":[{"url":"https://fail.example","message":"Unable to read this page."}],"metrics":{"successCount":1,"failureCount":1,"durationMs":12}}</web-search-status>',
      "Answer with source.",
    ].join("\n");

    render(
      <AIMessage
        msg={createMessage(content)}
        imageGallery={[]}
        isLoading={false}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(screen.getByText("Sources read")).toBeInTheDocument();
    expect(screen.getByText("1 read · 1 skipped")).toBeInTheDocument();
    expect(screen.getByText("React Docs")).toBeInTheDocument();
    expect(screen.getByText("https://react.dev")).toBeInTheDocument();
    expect(screen.getByText("Skipped sources")).toBeInTheDocument();
    expect(screen.getByText("Unable to read this page.")).toBeInTheDocument();
    expect(screen.getByText("https://fail.example")).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveAttribute("data-content", "Answer with source.");
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
