import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertToBase64 } from "@/lib/storage/attachmentStorage";
import { MAX_CHAT_IMAGE_FETCH_BYTES } from "./chatImageFetch";
import {
  copyImageSourceToClipboard,
  copyMessageContentToClipboard,
  extractRenderedMessageImageSources,
  extractRenderedMarkdownImageSources,
  extractMessageImageSources,
  extractMarkdownImageSources,
  formatMessageCopyText,
  stripMarkdownImageTokens,
  stripMessageImageTokens,
} from "./messageClipboard";

const svgMocks = vi.hoisted(() => ({
  rasterizeSvgDataUrlToPng: vi.fn(),
  rasterizeSvgBlobToPngBlob: vi.fn(),
}));

vi.mock("@/lib/storage/attachmentStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage/attachmentStorage")>();
  return {
    ...actual,
    convertToBase64: vi.fn(),
  };
});

vi.mock("./svgRasterize", () => ({
  isSvgDataUrl: (value: string) => value.trim().toLowerCase().startsWith("data:image/svg+xml"),
  isSvgImageMimeType: (value: string | null | undefined) => (value ?? "").split(";")[0].trim().toLowerCase() === "image/svg+xml",
  rasterizeSvgDataUrlToPng: svgMocks.rasterizeSvgDataUrlToPng,
  rasterizeSvgBlobToPngBlob: svgMocks.rasterizeSvgBlobToPngBlob,
}));

function createFetchedImageResponse(blob: Blob): Response {
  return {
    headers: new Headers({
      "content-length": String(blob.size),
      "content-type": blob.type,
    }),
    blob: vi.fn(async () => blob),
  } as unknown as Response;
}

describe("messageClipboard", () => {
  beforeEach(() => {
    svgMocks.rasterizeSvgDataUrlToPng.mockImplementation(async (value: string) => value);
    svgMocks.rasterizeSvgBlobToPngBlob.mockImplementation(async (blob: Blob) => blob);
    Object.defineProperty(window, "vlainaDesktop", {
      value: undefined,
      configurable: true,
    });
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
    svgMocks.rasterizeSvgDataUrlToPng.mockReset();
    svgMocks.rasterizeSvgBlobToPngBlob.mockReset();
    Object.defineProperty(window, "vlainaDesktop", {
      value: undefined,
      configurable: true,
    });
  });

  it("extracts markdown image sources from content", () => {
    const content = "A ![x](https://a.com/1.png) B ![y](<asset://localhost/chat-inline-image/2>) C ![z](<asset://localhost/2.webp>)";
    expect(extractMarkdownImageSources(content)).toEqual([
      "https://a.com/1.png",
      "asset://localhost/chat-inline-image/2",
    ]);
  });

  it("extracts image sources when URL contains parentheses", () => {
    const content = '![x](<https://a.com/path/(demo)/image.svg> "Preview")';
    expect(extractMarkdownImageSources(content)).toEqual([
      "https://a.com/path/(demo)/image.svg",
    ]);
  });

  it("extracts angle-wrapped markdown image sources with spaces", () => {
    const content = "![x](<images/image with space.png> \"Preview\")";

    expect(extractMarkdownImageSources(content)).toEqual([
      "images/image with space.png",
    ]);
    expect(stripMarkdownImageTokens(content)).toBe("");
    expect(formatMessageCopyText(content)).toBe("images/image with space.png");
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

  it("decodes markdown image target entities before source extraction", () => {
    const content = [
      "![query](https://a.com/path?a=1&amp;b=2.png)",
      "![angle](<https://a.com/path/with&#x2f;entity&#46;webp>)",
      "![named](<https://a.com/path&sol;with&period;entity.webp>)",
    ].join("\n");

    expect(extractMarkdownImageSources(content)).toEqual([
      "https://a.com/path?a=1&b=2.png",
      "https://a.com/path/with/entity.webp",
      "https://a.com/path/with.entity.webp",
    ]);
  });

  it("extracts message image sources from mixed markdown and html images in order", () => {
    const content = [
      'Intro <img src="https://a.com/1.png" alt="first" />',
      '![second](<asset://localhost/chat-inline-image/2>)',
      "<img src='data:image/png;base64,abc' alt='third'>",
    ].join(" ");

    expect(extractMessageImageSources(content)).toEqual([
      "https://a.com/1.png",
      "asset://localhost/chat-inline-image/2",
      "data:image/png;base64,abc",
    ]);
  });

  it("separates image sources that render as videos from image-only consumers", () => {
    const content = [
      "![video](https://example.com/movie.mp4)",
      '<img src="https://example.com/watch.webm">',
      "![real](https://example.com/real.png)",
      '<img src="https://example.com/real-html.png">',
    ].join("\n");

    expect(extractMarkdownImageSources(content)).toEqual([
      "https://example.com/movie.mp4",
      "https://example.com/real.png",
    ]);
    expect(extractRenderedMarkdownImageSources(content)).toEqual([
      "https://example.com/real.png",
    ]);
    expect(extractMessageImageSources(content)).toEqual([
      "https://example.com/movie.mp4",
      "https://example.com/watch.webm",
      "https://example.com/real.png",
      "https://example.com/real-html.png",
    ]);
    expect(extractRenderedMessageImageSources(content)).toEqual([
      "https://example.com/real.png",
      "https://example.com/real-html.png",
    ]);
    expect(stripMarkdownImageTokens(content)).toContain("![video](https://example.com/movie.mp4)");
    expect(stripMarkdownImageTokens(content)).not.toContain("![real](https://example.com/real.png)");
    expect(stripMessageImageTokens(content)).toContain("![video](https://example.com/movie.mp4)");
    expect(stripMessageImageTokens(content)).toContain('<img src="https://example.com/watch.webm">');
    expect(stripMessageImageTokens(content)).not.toContain("![real](https://example.com/real.png)");
    expect(stripMessageImageTokens(content)).not.toContain('<img src="https://example.com/real-html.png">');
  });

  it("drops unsafe markdown and html image sources before downstream image handling", () => {
    const content = [
      "![script](javascript:alert(1))",
      "![entity-script](javascript&colon;alert(1))",
      "![numeric-script](java&#x73;cript&#58;alert(1))",
      "![svg](<data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+>)",
      "![local](http://127.0.0.1:3000/secret.png)",
      "![traversal](attachment://..%2fsecret.png)",
      "![safe](attachment://safe.png)",
      '<img src="http://router/secret.png">',
      '<img src="javascript&colon;alert(1)">',
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
      '<img src="https://a.com/path&sol;with&period;entity.png" alt="named">',
      '<img src="java&#x73;cript:alert(1)" alt="blocked">',
    ].join("\n");

    expect(extractMessageImageSources(content)).toEqual([
      "https://a.com/path?a=1&b=2.png",
      "https://a.com/path/with.entity.png",
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

  it("does not treat html image tags inside markdown image labels as separate images", () => {
    const content = '![<img src="https://a.com/alt.png">](https://a.com/real.png)';

    expect(extractMessageImageSources(content)).toEqual([
      "https://a.com/real.png",
    ]);
    expect(stripMessageImageTokens(content)).toBe("");
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
      '<script>![script-markdown](https://a.com/script-markdown.png)</script>',
      '<style><img src="https://a.com/style.png"></style>',
      '<style>![style-markdown](https://a.com/style-markdown.png)</style>',
      '<textarea><img src="https://a.com/textarea.png"></textarea>',
      '<textarea>![textarea-markdown](https://a.com/textarea-markdown.png)</textarea>',
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

  it("formats copy text without case-insensitive raw data image tokens", () => {
    const content = [
      "Hello ![img](DATA:IMAGE/PNG;BASE64,abc)",
      '<img src="DATA:IMAGE/PNG;BASE64,def" alt="inline">',
    ].join("\n");

    expect(formatMessageCopyText(content)).toBe([
      "Hello [image]",
      "[image]",
    ].join("\n"));
  });

  it("formats copy text without raw html image tokens", () => {
    const content = [
      'Intro <img src="https://a.com/1.png" alt="first" />',
      '<img src="data:image/png;base64,abc" alt="inline">',
      '<img src="javascript:alert(1)" alt="unsafe">',
    ].join("\n");

    expect(formatMessageCopyText(content)).toBe([
      "Intro https://a.com/1.png",
      "[image]",
      '<img src="javascript:alert(1)" alt="unsafe">',
    ].join("\n"));
  });

  it("keeps code-block image examples in formatted copy text", () => {
    const content = [
      "Use this syntax:",
      "```md",
      "![example](https://a.com/code.png)",
      '<img src="https://a.com/code-html.png">',
      "```",
      'Result: ![real](https://a.com/real.png) <img src="https://a.com/real-html.png">',
    ].join("\n");

    expect(formatMessageCopyText(content)).toBe([
      "Use this syntax:",
      "```md",
      "![example](https://a.com/code.png)",
      '<img src="https://a.com/code-html.png">',
      "```",
      "Result: https://a.com/real.png https://a.com/real-html.png",
    ].join("\n"));
  });

  it("treats legacy web search status text as ordinary copy content", () => {
    const content = [
      '<web-search-status>{"phase":"searching","query":"catime"}</web-search-status>',
      '<web-search-status>{"phase":"results","query":"catime","metrics":{"resultCount":1,"durationMs":25}}</web-search-status>',
      'Catime is a timer app.',
    ].join('');

    expect(formatMessageCopyText(content)).toBe(content);
  });

  it("keeps unterminated legacy status text", () => {
    const content = 'Visible answer.\n<web-search-status>{"phase":"searching","query":"catime"';

    expect(formatMessageCopyText(content)).toBe(content);
  });

  it("keeps legacy web search request text", () => {
    const content = [
      'We need to search.',
      '<web_search_request>{"query":"catime","reason":"current info"}</web_search_request>',
      'Catime answer.',
    ].join('\n');

    expect(formatMessageCopyText(content)).toBe(content);
  });

  it("formats copy text without rendered thinking content", () => {
    expect(formatMessageCopyText("<think>private plan</think>Final answer")).toBe("Final answer");
  });

  it("copies image blob when clipboard image write is available", async () => {
    const writeMock = vi.spyOn(navigator.clipboard, "write");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createFetchedImageResponse(new Blob(["x"], { type: "image/png" }))),
    );

    const copied = await copyImageSourceToClipboard("https://a.com/1.png");

    expect(copied).toBe(true);
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it("copies fetched image blobs through the desktop image clipboard", async () => {
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
    const writeMock = vi.spyOn(navigator.clipboard, "write");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createFetchedImageResponse(new Blob(["x"], { type: "image/png" }))),
    );

    const copied = await copyImageSourceToClipboard("https://a.com/cover.jpg#w=72%25");

    expect(copied).toBe(true);
    expect(fetch).toHaveBeenCalledWith("https://a.com/cover.jpg", expect.objectContaining({
      credentials: "omit",
      referrerPolicy: "no-referrer",
    }));
    expect(writeImage).toHaveBeenCalledWith("data:image/png;base64,eA==");
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("keeps fetched jpeg images in their original format for the desktop image clipboard", async () => {
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
    const createImageBitmapMock = vi.fn();
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createFetchedImageResponse(new Blob(["jpg"], { type: "image/jpeg" }))),
    );

    const copied = await copyImageSourceToClipboard("https://a.com/cover.jpg#w=72%25");

    expect(copied).toBe(true);
    expect(writeImage).toHaveBeenCalledWith("data:image/jpeg;base64,anBn");
    expect(createImageBitmapMock).not.toHaveBeenCalled();
  });

  it("normalizes fetched jpeg MIME parameters for the desktop image clipboard", async () => {
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createFetchedImageResponse(new Blob(["jpg"], { type: "image/jpeg; charset=utf-8" }))),
    );

    const copied = await copyImageSourceToClipboard("https://a.com/cover.jpg#w=72%25");

    expect(copied).toBe(true);
    expect(writeImage).toHaveBeenCalledWith("data:image/jpeg;base64,anBn");
  });

  it("converts fetched jpeg images to png before using the web image clipboard", async () => {
    const writeMock = vi.spyOn(navigator.clipboard, "write");
    const drawImage = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({ drawImage })),
          toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(["png"], { type: "image/png" }))),
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement);
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({
      width: 2,
      height: 1,
      close: vi.fn(),
    })));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createFetchedImageResponse(new Blob(["jpg"], { type: "image/jpeg" }))),
    );

    const copied = await copyImageSourceToClipboard("https://a.com/cover.jpg#w=72%25");

    expect(copied).toBe(true);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledWith([
      expect.objectContaining({
        data: {
          "image/png": expect.any(Blob),
        },
      }),
    ]);

    createElementSpy.mockRestore();
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

  it("copies case-insensitive data URL images through the desktop image clipboard when available", async () => {
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

    const copied = await copyImageSourceToClipboard("DATA:IMAGE/PNG;BASE64,eA==");

    expect(copied).toBe(true);
    expect(writeImage).toHaveBeenCalledWith("data:image/png;base64,eA==");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch unsafe direct image sources when copying", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(copyImageSourceToClipboard("javascript:alert(1)")).resolves.toBe(false);
    await expect(copyImageSourceToClipboard("http://127.0.0.1:3000/secret.png")).resolves.toBe(false);
    await expect(copyImageSourceToClipboard("images/demo.png")).resolves.toBe(false);
    await expect(copyImageSourceToClipboard("asset://localhost/chat-inline-image/0")).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves stored attachment images before copying", async () => {
    const writeMock = vi.spyOn(navigator.clipboard, "write");
    vi.mocked(convertToBase64).mockResolvedValue("data:image/png;base64,eA==");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createFetchedImageResponse(new Blob(["x"], { type: "image/png" }))),
    );

    const copied = await copyImageSourceToClipboard("attachment://demo.png");

    expect(copied).toBe(true);
    expect(convertToBase64).toHaveBeenCalledWith(expect.objectContaining({
      previewUrl: "attachment://demo.png",
      assetUrl: "attachment://demo.png",
    }));
    expect(fetch).toHaveBeenCalledWith("data:image/png;base64,eA==", expect.objectContaining({
      credentials: "omit",
      referrerPolicy: "no-referrer",
    }));
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it("does not resolve bare image filenames before copying", async () => {
    const writeMock = vi.spyOn(navigator.clipboard, "write");
    vi.mocked(convertToBase64).mockResolvedValue("data:image/jpeg;base64,eA==");
    vi.stubGlobal("fetch", vi.fn());

    const copied = await copyImageSourceToClipboard("demo.jpg");

    expect(copied).toBe(false);
    expect(convertToBase64).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("rasterizes stored svg attachments before copying", async () => {
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
    vi.mocked(convertToBase64).mockResolvedValue("data:image/svg+xml;base64,PHN2Zz4=");
    svgMocks.rasterizeSvgDataUrlToPng.mockResolvedValue("data:image/png;base64,RASTER");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const copied = await copyImageSourceToClipboard("attachment://diagram.svg");

    expect(copied).toBe(true);
    expect(svgMocks.rasterizeSvgDataUrlToPng).toHaveBeenCalledWith("data:image/svg+xml;base64,PHN2Zz4=");
    expect(writeImage).toHaveBeenCalledWith("data:image/png;base64,RASTER");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rasterizes fetched svg images before copying to the clipboard", async () => {
    const svgBlob = new Blob(["<svg></svg>"], { type: "image/svg+xml" });
    const pngBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const writeMock = vi.spyOn(navigator.clipboard, "write");
    svgMocks.rasterizeSvgBlobToPngBlob.mockResolvedValue(pngBlob);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createFetchedImageResponse(svgBlob)),
    );

    const copied = await copyImageSourceToClipboard("https://a.com/diagram.svg");

    expect(copied).toBe(true);
    expect(svgMocks.rasterizeSvgBlobToPngBlob).toHaveBeenCalledWith(svgBlob);
    expect(writeMock).toHaveBeenCalledWith([
      expect.objectContaining({
        data: {
          "image/png": pngBlob,
        },
      }),
    ]);
  });

  it("does not copy oversized rasterized SVG output to the clipboard", async () => {
    const svgBlob = new Blob(["<svg></svg>"], { type: "image/svg+xml" });
    const oversizedPngBlob = {
      type: "image/png",
      size: MAX_CHAT_IMAGE_FETCH_BYTES + 1,
    } as unknown as Blob;
    const writeMock = vi.spyOn(navigator.clipboard, "write");
    svgMocks.rasterizeSvgBlobToPngBlob.mockResolvedValue(oversizedPngBlob);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createFetchedImageResponse(svgBlob)),
    );

    const copied = await copyImageSourceToClipboard("https://a.com/diagram.svg");

    expect(copied).toBe(false);
    expect(svgMocks.rasterizeSvgBlobToPngBlob).toHaveBeenCalledWith(svgBlob);
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("does not copy rasterized SVG output with invalid size metadata", async () => {
    const svgBlob = new Blob(["<svg></svg>"], { type: "image/svg+xml" });
    const invalidPngBlob = {
      type: "image/png",
      size: -1,
    } as unknown as Blob;
    const writeMock = vi.spyOn(navigator.clipboard, "write");
    svgMocks.rasterizeSvgBlobToPngBlob.mockResolvedValue(invalidPngBlob);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createFetchedImageResponse(svgBlob)),
    );

    const copied = await copyImageSourceToClipboard("https://a.com/diagram.svg");

    expect(copied).toBe(false);
    expect(svgMocks.rasterizeSvgBlobToPngBlob).toHaveBeenCalledWith(svgBlob);
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("falls back to text copy when image copy fails", async () => {
    const writeTextMock = vi.spyOn(navigator.clipboard, "writeText");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await copyMessageContentToClipboard("Result: ![img](https://a.com/1.png)");

    expect(writeTextMock).toHaveBeenCalledWith("Result: https://a.com/1.png");
  });

  it("does not fetch video markdown before falling back to text copy", async () => {
    const writeTextMock = vi.spyOn(navigator.clipboard, "writeText");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await copyMessageContentToClipboard("Result: ![video](https://example.com/movie.mp4)");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(writeTextMock).toHaveBeenCalledWith("Result: https://example.com/movie.mp4");
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
      vi.fn().mockResolvedValue(createFetchedImageResponse(new Blob(["x"], { type: "image/png" }))),
    );

    await copyMessageContentToClipboard([
      "```md",
      "![example](https://a.com/code.png)",
      "```",
      "![real](https://a.com/real.png)",
    ].join("\n"));

    expect(fetch).toHaveBeenCalledWith("https://a.com/real.png", expect.objectContaining({
      credentials: "omit",
      referrerPolicy: "no-referrer",
    }));
    expect(writeMock).toHaveBeenCalledTimes(1);
  });
});
