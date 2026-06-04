import { describe, expect, it } from "vitest";
import { buildTitleSourceFromMessages } from "./temporaryChat";
import type { ChatMessage } from "./types";

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  const content = overrides.content ?? "";
  const timestamp = overrides.timestamp ?? Date.now();
  return {
    id: overrides.id ?? "m1",
    role: overrides.role ?? "user",
    content,
    modelId: overrides.modelId ?? "model-1",
    timestamp,
    ...(overrides.imageSources !== undefined ? { imageSources: overrides.imageSources } : {}),
    versions:
      overrides.versions ?? [{ content, createdAt: timestamp, kind: 'original' as const, subsequentMessages: [] }],
    currentVersionIndex: overrides.currentVersionIndex ?? 0,
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
        content: "![image](attachment://safe.png)\n\n  Plan   trip to   Tokyo  ",
      }),
      createMessage({
        role: "assistant",
        content: "ok",
      }),
    ];

    expect(buildTitleSourceFromMessages(messages)).toBe("Plan trip to Tokyo");
  });

  it("removes only renderable markdown image tokens from title source", () => {
    const messages: ChatMessage[] = [
      createMessage({
        role: "user",
        content: [
          '![outer [nested]](<attachment://safe.png> "Title")',
          '![video](https://example.com/movie.mp4)',
          '![blocked](asset://localhost/image.png)',
          "```md",
          "![example](asset://code.png)",
          "```",
          String.raw`\![literal](asset://escaped.png)`,
          "Plan trip to Tokyo",
        ].join("\n"),
      }),
    ];

    expect(buildTitleSourceFromMessages(messages)).toBe(
      "![video](https://example.com/movie.mp4) ![blocked](asset://localhost/image.png) ```md ![example](asset://code.png) ``` \\![literal](asset://escaped.png) Plan trip to Tokyo",
    );
  });

  it("removes rendered thinking content from title source messages", () => {
    const messages: ChatMessage[] = [
      createMessage({
        role: "user",
        content: "<think>private draft</think>Plan trip to Tokyo",
      }),
      createMessage({
        role: "user",
        content: "<think>unfinished private draft",
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
