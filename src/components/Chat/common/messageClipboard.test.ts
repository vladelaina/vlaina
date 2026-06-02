import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertToBase64 } from "@/lib/storage/attachmentStorage";
import {
  copyImageSourceToClipboard,
  copyMessageContentToClipboard,
  extractMessageImageSources,
  extractMarkdownImageSources,
  formatMessageCopyText,
  stripMarkdownImageTokens,
  stripMessageImageTokens,
} from "./messageClipboard";

vi.mock("@/lib/storage/attachmentStorage", () => ({
  convertToBase64: vi.fn(),
}));

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
    vi.mocked(convertToBase64).mockReset();
    Object.defineProperty(window, "vlainaDesktop", {
      value: undefined,
      configurable: true,
    });
  });

  it("extracts markdown image sources from content", () => {
    const content = "A ![x](https://a.com/1.png) B ![y](<asset://localhost/2.webp>)";
    expect(extractMarkdownImageSources(content)).toEqual([
      "https://a.com/1.png",
      "asset://localhost/2.webp",
    ]);
  });

  it("extracts image sources when URL contains parentheses", () => {
    const content = '![x](<https://a.com/path/(demo)/image.svg> "Preview")';
    expect(extractMarkdownImageSources(content)).toEqual([
      "https://a.com/path/(demo)/image.svg",
    ]);
  });

  it("extracts markdown image sources with escaped destination parentheses", () => {
    const content = [
      String.raw`![escaped](https://a.com/path/image-\).png "Preview")`,
      String.raw`![angle](<https://a.com/path/image-\).webp>)`,
    ].join("\n");

    expect(extractMarkdownImageSources(content)).toEqual([
      "https://a.com/path/image-).png",
      "https://a.com/path/image-).webp",
    ]);
    expect(stripMarkdownImageTokens(content)).toBe("\n");
    expect(formatMessageCopyText(content)).toBe([
      "https://a.com/path/image-).png",
      "https://a.com/path/image-).webp",
    ].join("\n"));
  });

  it("extracts message image sources from mixed markdown and html images in order", () => {
    const content = [
      'Intro <img src="https://a.com/1.png" alt="first" />',
      '![second](<asset://localhost/2.webp>)',
      "<img src='data:image/png;base64,abc' alt='third'>",
    ].join(" ");

    expect(extractMessageImageSources(content)).toEqual([
      "https://a.com/1.png",
      "asset://localhost/2.webp",
      "data:image/png;base64,abc",
    ]);
  });

  it("drops unsafe markdown and html image sources before downstream image handling", () => {
    const content = [
      "![script](javascript:alert(1))",
      "![svg](<data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+>)",
      "![local](http://127.0.0.1:3000/secret.png)",
      "![traversal](attachment://..%2fsecret.png)",
      "![safe](attachment://safe.png)",
      '<img src="http://router/secret.png">',
      '<img src="data:image/png;base64,aGk=">',
    ].join("\n");

    expect(extractMarkdownImageSources(content)).toEqual(["attachment://safe.png"]);
    expect(extractMessageImageSources(content)).toEqual([
      "attachment://safe.png",
      "data:image/png;base64,aGk=",
    ]);
  });

  it("strips only safe markdown image tokens and preserves unsafe image markup as text", () => {
    const content = [
      "![script](javascript:alert(1))",
      "![safe](https://example.com/safe.png)",
      "caption",
    ].join("\n");

    expect(stripMarkdownImageTokens(content)).toBe([
      "![script](javascript:alert(1))",
      "",
      "caption",
    ].join("\n"));
    expect(formatMessageCopyText(content)).toBe([
      "![script](javascript:alert(1))",
      "https://example.com/safe.png",
      "caption",
    ].join("\n"));
  });

  it("extracts only real src attributes from html image tags", () => {
    const content = [
      '<img data-src="https://a.com/lazy.png" alt="not loaded">',
      '<img src="https://a.com/path/with>char.png" alt="quoted">',
      '<img alt="before" SRC=https://a.com/unquoted.png>',
    ].join("\n");

    expect(extractMessageImageSources(content)).toEqual([
      "https://a.com/path/with>char.png",
      "https://a.com/unquoted.png",
    ]);
  });

  it("decodes html image src entities before source extraction and safety checks", () => {
    const content = [
      '<img src="https://a.com/path?a=1&amp;b=2.png" alt="entity">',
      '<img src="java&#x73;cript:alert(1)" alt="blocked">',
    ].join("\n");

    expect(extractMessageImageSources(content)).toEqual([
      "https://a.com/path?a=1&b=2.png",
    ]);
  });

  it("ignores markdown and html image examples inside fenced code", () => {
    const content = [
      "Before ![real](https://a.com/real.png)",
      "```md",
      "![example](https://a.com/code.png)",
      '<img src="https://a.com/code-html.png">',
      "```",
      '<img src="https://a.com/real-html.png">',
    ].join("\n");

    expect(extractMarkdownImageSources(content)).toEqual(["https://a.com/real.png"]);
    expect(extractMessageImageSources(content)).toEqual([
      "https://a.com/real.png",
      "https://a.com/real-html.png",
    ]);
  });

  it("ignores markdown and html image examples inside inline code", () => {
    const content = [
      "`![example](https://a.com/code.png)`",
      '`<img src="https://a.com/code-html.png">`',
      "![real](https://a.com/real.png)",
      '<img src="https://a.com/real-html.png">',
    ].join("\n");

    expect(extractMessageImageSources(content)).toEqual([
      "https://a.com/real.png",
      "https://a.com/real-html.png",
    ]);
  });

  it("keeps real markdown images when alt text contains inline code", () => {
    const content = "![`alt`](https://a.com/real.png)";

    expect(extractMarkdownImageSources(content)).toEqual(["https://a.com/real.png"]);
  });

  it("parses markdown image labels without treating nested label text as a target", () => {
    const content = [
      "![outer [nested](https://a.com/not-target.png)](https://a.com/real.png)",
      "![label `](https://a.com/not-code-target.png)`](https://a.com/code-alt.png)",
      "![literal \\] text](https://a.com/escaped-alt.png)",
    ].join("\n");

    expect(extractMarkdownImageSources(content)).toEqual([
      "https://a.com/real.png",
      "https://a.com/code-alt.png",
      "https://a.com/escaped-alt.png",
    ]);
  });

  it("keeps escaped image syntax as ordinary text", () => {
    const content = [
      String.raw`\![literal](https://a.com/not-image.png)`,
      String.raw`\<img src="https://a.com/not-html-image.png">`,
      "![real](https://a.com/real.png)",
      '<img src="https://a.com/real-html.png">',
    ].join("\n");

    expect(extractMarkdownImageSources(content)).toEqual(["https://a.com/real.png"]);
    expect(extractMessageImageSources(content)).toEqual([
      "https://a.com/real.png",
      "https://a.com/real-html.png",
    ]);
    expect(formatMessageCopyText(content)).toContain(String.raw`\![literal](https://a.com/not-image.png)`);
  });

  it("ignores image syntax inside html comments", () => {
    const content = [
      '<!-- ![comment](https://a.com/comment.png) -->',
      '<!-- <img src="https://a.com/comment-html.png"> -->',
      "![real](https://a.com/real.png)",
      '<img src="https://a.com/real-html.png">',
    ].join("\n");

    expect(extractMarkdownImageSources(content)).toEqual(["https://a.com/real.png"]);
    expect(extractMessageImageSources(content)).toEqual([
      "https://a.com/real.png",
      "https://a.com/real-html.png",
    ]);
  });

  it("ignores image syntax inside raw html that does not render as markdown images", () => {
    const content = [
      '<script><img src="https://a.com/script.png"></script>',
      '<style><img src="https://a.com/style.png"></style>',
      '<textarea><img src="https://a.com/textarea.png"></textarea>',
      '<div>',
      '![inside-html-block](https://a.com/html-block.png)',
      '</div>',
      '',
      "![real](https://a.com/real.png)",
      '<img src="https://a.com/real-html.png">',
    ].join("\n");

    expect(extractMarkdownImageSources(content)).toEqual(["https://a.com/real.png"]);
    expect(extractMessageImageSources(content)).toEqual([
      "https://a.com/real.png",
      "https://a.com/real-html.png",
    ]);
  });

  it("strips only renderable message image tokens", () => {
    const content = [
      "Intro ![real](https://a.com/real.png)",
      "```md",
      "![example](https://a.com/code.png)",
      '<img src="https://a.com/code-html.png">',
      "```",
      '<img src="https://a.com/real-html.png">',
    ].join("\n");

    expect(stripMessageImageTokens(content)).toBe([
      "Intro ",
      "```md",
      "![example](https://a.com/code.png)",
      '<img src="https://a.com/code-html.png">',
      "```",
      "",
    ].join("\n"));
  });

  it("formats copy text without raw markdown image tokens", () => {
    const content = "Hello ![img](https://a.com/1.png) world ![img](data:image/png;base64,abc)";
    expect(formatMessageCopyText(content)).toBe("Hello https://a.com/1.png world [image]");
  });

  it("keeps code-block image examples in formatted copy text", () => {
    const content = [
      "Use this syntax:",
      "```md",
      "![example](https://a.com/code.png)",
      "```",
      "Result: ![real](https://a.com/real.png)",
    ].join("\n");

    expect(formatMessageCopyText(content)).toBe([
      "Use this syntax:",
      "```md",
      "![example](https://a.com/code.png)",
      "```",
      "Result: https://a.com/real.png",
    ].join("\n"));
  });

  it("formats copy text without web search status metadata", () => {
    const content = [
      '<web-search-status>{"phase":"searching","query":"catime"}</web-search-status>',
      '<web-search-status>{"phase":"results","query":"catime","metrics":{"resultCount":1,"durationMs":25}}</web-search-status>',
      'Catime is a timer app.',
    ].join('');

    expect(formatMessageCopyText(content)).toBe("Catime is a timer app.");
  });

  it("formats copy text without rendered thinking content", () => {
    expect(formatMessageCopyText("<think>private plan</think>Final answer")).toBe("Final answer");
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

  it("copies data URL images through the desktop image clipboard when available", async () => {
    const writeImage = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, "vlainaDesktop", {
      value: {
        platform: "electron",
        clipboard: {
          writeText: vi.fn(),
          writeImage,
        },
      },
      configurable: true,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const copied = await copyImageSourceToClipboard("data:image/png;base64,eA==");

    expect(copied).toBe(true);
    expect(writeImage).toHaveBeenCalledWith("data:image/png;base64,eA==");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves stored attachment images before copying", async () => {
    const writeMock = vi.spyOn(navigator.clipboard, "write");
    vi.mocked(convertToBase64).mockResolvedValue("data:image/png;base64,eA==");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(["x"], { type: "image/png" })),
      }),
    );

    const copied = await copyImageSourceToClipboard("attachment://demo.png");

    expect(copied).toBe(true);
    expect(convertToBase64).toHaveBeenCalledWith(expect.objectContaining({
      previewUrl: "attachment://demo.png",
      assetUrl: "attachment://demo.png",
    }));
    expect(fetch).toHaveBeenCalledWith("data:image/png;base64,eA==");
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to text copy when image copy fails", async () => {
    const writeTextMock = vi.spyOn(navigator.clipboard, "writeText");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await copyMessageContentToClipboard("Result: ![img](https://a.com/1.png)");

    expect(writeTextMock).toHaveBeenCalledWith("Result: https://a.com/1.png");
  });

  it("does not copy code-block image examples before falling back to text", async () => {
    const writeTextMock = vi.spyOn(navigator.clipboard, "writeText");
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);

    await copyMessageContentToClipboard([
      "```md",
      "![example](https://a.com/code.png)",
      "```",
      "Plain text",
    ].join("\n"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(writeTextMock).toHaveBeenCalledWith([
      "```md",
      "![example](https://a.com/code.png)",
      "```",
      "Plain text",
    ].join("\n"));
  });

  it("copies the first real image outside code examples", async () => {
    const writeMock = vi.spyOn(navigator.clipboard, "write");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(["x"], { type: "image/png" })),
      }),
    );

    await copyMessageContentToClipboard([
      "```md",
      "![example](https://a.com/code.png)",
      "```",
      "![real](https://a.com/real.png)",
    ].join("\n"));

    expect(fetch).toHaveBeenCalledWith("https://a.com/real.png");
    expect(writeMock).toHaveBeenCalledTimes(1);
  });
});
