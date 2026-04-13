import { createRef } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ChatMessage } from "@/lib/ai/types";

const { messageItemSpy } = vi.hoisted(() => ({
  messageItemSpy: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/MessageItem", () => ({
  MessageItem: (props: any) => {
    messageItemSpy(props);
    return <div data-testid={`message-item-${props.msg.id}`} />;
  },
}));

vi.mock("@/components/Chat/features/Messages/components/ChatLoading", () => ({
  ChatLoading: () => <div data-testid="chat-loading" />,
}));

import { MessageList } from "./MessageList";

function createMessage(id: string, role: ChatMessage["role"]): ChatMessage {
  const content = `${role}-${id}`;
  const timestamp = Date.now();
  return {
    id,
    role,
    content,
    modelId: "model-a",
    timestamp,
    versions: [{ content, createdAt: timestamp, subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

describe("MessageList", () => {
  beforeEach(() => {
    messageItemSpy.mockClear();
  });

  it("renders an empty hidden scroll container when there are no messages", () => {
    const containerRef = createRef<HTMLDivElement>();

    render(
      <MessageList
        messages={[]}
        getImageGallery={() => []}
        isSessionActive={false}
        showLoading={false}
        spacerHeight={24}
        containerRef={containerRef}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    const scrollable = document.querySelector('[data-chat-scrollable="true"]');
    expect(scrollable).not.toBeNull();
    expect(scrollable).toHaveClass("opacity-0");
    expect(scrollable).toHaveClass("pointer-events-none");
    expect(messageItemSpy).not.toHaveBeenCalled();
  });

  it("marks only the last message as loading when the session is active", () => {
    const messages = [
      createMessage("u1", "user"),
      createMessage("a1", "assistant"),
      createMessage("a2", "assistant"),
    ];

    render(
      <MessageList
        messages={messages}
        getImageGallery={() => []}
        isSessionActive
        showLoading={false}
        spacerHeight={0}
        containerRef={createRef<HTMLDivElement>()}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(messageItemSpy).toHaveBeenCalledTimes(3);
    expect(messageItemSpy.mock.calls[0][0]).toMatchObject({ msg: messages[0], isLoading: false });
    expect(messageItemSpy.mock.calls[1][0]).toMatchObject({ msg: messages[1], isLoading: false });
    expect(messageItemSpy.mock.calls[2][0]).toMatchObject({ msg: messages[2], isLoading: true });
  });

  it("passes handlers and image gallery getter through to each message item", () => {
    const onCopy = vi.fn();
    const onRegenerate = vi.fn();
    const onEdit = vi.fn();
    const onSwitchVersion = vi.fn();
    const getImageGallery = vi.fn(() => [{ id: "img-1", src: "https://example.com/1.png" }]);

    render(
      <MessageList
        messages={[createMessage("a1", "assistant")]}
        getImageGallery={getImageGallery}
        isSessionActive={false}
        showLoading={false}
        spacerHeight={10}
        containerRef={createRef<HTMLDivElement>()}
        onCopy={onCopy}
        onRegenerate={onRegenerate}
        onEdit={onEdit}
        onSwitchVersion={onSwitchVersion}
      />,
    );

    expect(messageItemSpy.mock.calls[0][0]).toMatchObject({
      getImageGallery,
      onCopy,
      onRegenerate,
      onEdit,
      onSwitchVersion,
    });
  });

  it("shows the trailing loading indicator when requested", () => {
    render(
      <MessageList
        messages={[createMessage("a1", "assistant")]}
        getImageGallery={() => []}
        isSessionActive={false}
        showLoading
        spacerHeight={0}
        containerRef={createRef<HTMLDivElement>()}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onSwitchVersion={() => {}}
      />,
    );

    expect(screen.getByTestId("chat-loading")).toBeInTheDocument();
  });
});
