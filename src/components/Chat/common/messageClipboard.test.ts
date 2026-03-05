import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  copyImageSourceToClipboard,
  copyMessageContentToClipboard,
  extractMarkdownImageSources,
  formatMessageCopyText,
} from "./messageClipboard";

describe("messageClipboard", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        write: vi.fn(),
        writeText: vi.fn(),
      },
      configurable: true,
    });
    Object.defineProperty(window, "ClipboardItem", {
      value: class {
        constructor(public data: Record<string, Blob>) {}
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts markdown image sources from content", () => {
    const content = "A ![x](https://a.com/1.png) B ![y](<asset://localhost/2.webp>)";
    expect(extractMarkdownImageSources(content)).toEqual([
      "https://a.com/1.png",
      "asset://localhost/2.webp",
    ]);
  });

  it("formats copy text without raw markdown image tokens", () => {
    const content = "Hello ![img](https://a.com/1.png) world ![img](data:image/png;base64,abc)";
    expect(formatMessageCopyText(content)).toBe("Hello https://a.com/1.png world [image]");
  });

  it("copies image blob when clipboard image write is available", async () => {
    const writeMock = vi.spyOn(navigator.clipboard, "write");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(["x"], { type: "image/png" })),
      }),
    );

    const copied = await copyImageSourceToClipboard("https://a.com/1.png");

    expect(copied).toBe(true);
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to text copy when image copy fails", async () => {
    const writeTextMock = vi.spyOn(navigator.clipboard, "writeText");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await copyMessageContentToClipboard("Result: ![img](https://a.com/1.png)");

    expect(writeTextMock).toHaveBeenCalledWith("Result: https://a.com/1.png");
  });
});
