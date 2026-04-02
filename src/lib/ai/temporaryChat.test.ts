import { describe, expect, it } from "vitest";
import { buildTitleSourceFromMessages } from "./temporaryChat";
import type { ChatMessage } from "./types";

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: overrides.id || "m1",
    role: overrides.role || "user",
    content: overrides.content || "",
    modelId: overrides.modelId || "model-1",
    timestamp: overrides.timestamp || Date.now(),
    ...overrides,
  };
}

describe("buildTitleSourceFromMessages", () => {

  it("returns Image Query when no user message exists", () => {
    const messages: ChatMessage[] = [
      createMessage({ role: "assistant", content: "hello" }),
      createMessage({ role: "system", content: "meta" }),
    ];

    expect(buildTitleSourceFromMessages(messages)).toBe("Image Query");
  });

  it("removes markdown image tokens and normalizes spaces", () => {
    const messages: ChatMessage[] = [
      createMessage({
        role: "user",
        content: "![image](asset://a)\n\n  Plan   trip to   Tokyo  ",
      }),
      createMessage({
        role: "assistant",
        content: "ok",
      }),
    ];

    expect(buildTitleSourceFromMessages(messages)).toBe("Plan trip to Tokyo");
  });

  it("joins multiple user messages in order", () => {
    const messages: ChatMessage[] = [
      createMessage({ role: "user", content: "first user prompt" }),
      createMessage({ role: "assistant", content: "assistant reply" }),
      createMessage({ role: "user", content: "second user prompt" }),
    ];

    expect(buildTitleSourceFromMessages(messages)).toBe(
      "first user prompt\nsecond user prompt",
    );
  });

  it("caps output length to prevent huge title prompts", () => {
    const longText = "x".repeat(1500);
    const messages: ChatMessage[] = [
      createMessage({ role: "user", content: longText }),
    ];

    expect(buildTitleSourceFromMessages(messages)).toHaveLength(1200);
  });
});
