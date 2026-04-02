import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ChatMessage } from "@/lib/ai/types";

const { userMessageSpy, aiMessageSpy } = vi.hoisted(() => ({
  userMessageSpy: vi.fn(),
  aiMessageSpy: vi.fn(),
}));

vi.mock("./UserMessage", () => ({
  UserMessage: (props: any) => {
    userMessageSpy(props);
    return <div data-testid="user-message" />;
  },
}));

vi.mock("./AIMessage", () => ({
  AIMessage: (props: any) => {
    aiMessageSpy(props);
    return <div data-testid="ai-message" />;
  },
}));

import { MessageItem } from "./MessageItem";

function createMessage(role: ChatMessage["role"], id: string): ChatMessage {
  return {
    id,
    role,
    content: `${role}-${id}`,
    modelId: "model-a",
    timestamp: Date.now(),
  };
}

describe("MessageItem", () => {
  beforeEach(() => {
    userMessageSpy.mockClear();
    aiMessageSpy.mockClear();
  });

  it("renders user messages with the user message component", () => {
    const onEdit = vi.fn();
    const onSwitchVersion = vi.fn();

    render(
      <MessageItem
        msg={createMessage("user", "u1")}
        imageGallery={[]}
        isLoading={false}
        onCopy={() => {}}
        onRegenerate={() => {}}
        onEdit={onEdit}
        onSwitchVersion={onSwitchVersion}
      />,
    );

    expect(screen.getByTestId("user-message")).toBeInTheDocument();
    expect(screen.getByTestId("user-message").closest("[data-role]")).toHaveAttribute("data-role", "user");
    expect(userMessageSpy).toHaveBeenCalledTimes(1);
    expect(userMessageSpy.mock.calls[0][0]).toMatchObject({
      message: expect.objectContaining({ id: "u1", role: "user" }),
      onEdit,
      onSwitchVersion,
    });
    expect(aiMessageSpy).not.toHaveBeenCalled();
  });

  it("renders assistant messages with bound regenerate and version callbacks", () => {
    const onRegenerate = vi.fn();
    const onSwitchVersion = vi.fn();
    const onCopy = vi.fn();
    const msg = createMessage("assistant", "a1");
    const getImageGallery = vi.fn(() => [{ id: "img-1", src: "https://example.com/1.png" }]);

    render(
      <MessageItem
        msg={msg}
        getImageGallery={getImageGallery}
        isLoading
        onCopy={onCopy}
        onRegenerate={onRegenerate}
        onSwitchVersion={onSwitchVersion}
      />,
    );

    expect(screen.getByTestId("ai-message")).toBeInTheDocument();
    expect(screen.getByTestId("ai-message").closest("[data-role]")).toHaveAttribute("data-role", "assistant");
    expect(aiMessageSpy).toHaveBeenCalledTimes(1);

    const props = aiMessageSpy.mock.calls[0][0];
    expect(props).toMatchObject({
      msg,
      getImageGallery,
      isLoading: true,
      onCopy,
    });

    props.onRegenerate();
    props.onSwitchVersion(2);

    expect(onRegenerate).toHaveBeenCalledWith("a1");
    expect(onSwitchVersion).toHaveBeenCalledWith("a1", 2);
    expect(userMessageSpy).not.toHaveBeenCalled();
  });

});
