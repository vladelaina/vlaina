import { describe, expect, it } from "vitest";
import { createMarkdownSanitizeSchema, normalizeRenderableImageSrc } from "./imagePolicy";

describe("normalizeRenderableImageSrc", () => {
  it("allows common renderable image schemes", () => {
    expect(normalizeRenderableImageSrc("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(normalizeRenderableImageSrc("http://example.com/a.png")).toBe("http://example.com/a.png");
    expect(normalizeRenderableImageSrc("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    expect(normalizeRenderableImageSrc("blob:https://example.com/id")).toBe("blob:https://example.com/id");
    expect(normalizeRenderableImageSrc("asset://localhost/image.png")).toBe("asset://localhost/image.png");
    expect(normalizeRenderableImageSrc("attachment://demo%20image.png")).toBe("attachment://demo%20image.png");
    expect(normalizeRenderableImageSrc("app-file://attachment/demo%20image.png")).toBe("app-file://attachment/demo%20image.png");
  });

  it("allows relative image paths", () => {
    expect(normalizeRenderableImageSrc("/images/a.png")).toBe("/images/a.png");
    expect(normalizeRenderableImageSrc("./images/a.png")).toBe("./images/a.png");
    expect(normalizeRenderableImageSrc("../images/a.png")).toBe("../images/a.png");
  });

  it("rejects dangerous and invalid protocols", () => {
    expect(normalizeRenderableImageSrc("javascript:alert(1)")).toBeNull();
    expect(normalizeRenderableImageSrc("vbscript:msgbox(1)")).toBeNull();
    expect(normalizeRenderableImageSrc("file:///tmp/image.png")).toBeNull();
    expect(normalizeRenderableImageSrc("app://localhost/image.png")).toBeNull();
    expect(normalizeRenderableImageSrc("app-file://other/image.png")).toBeNull();
    expect(normalizeRenderableImageSrc("custom://localhost/image.png")).toBeNull();
    expect(normalizeRenderableImageSrc("asset://evilhost/image.png")).toBeNull();
    expect(normalizeRenderableImageSrc("")).toBeNull();
    expect(normalizeRenderableImageSrc("   ")).toBeNull();
    expect(normalizeRenderableImageSrc("not a url")).toBeNull();
    expect(normalizeRenderableImageSrc("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(normalizeRenderableImageSrc("data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+")).toBeNull();
    expect(normalizeRenderableImageSrc("data:image/png,not-base64")).toBeNull();
  });
});

describe("createMarkdownSanitizeSchema", () => {
  it("limits sanitize protocols to safe image schemes", () => {
    const schema = createMarkdownSanitizeSchema();
    const hrefProtocols = schema.protocols?.href || [];
    const srcProtocols = schema.protocols?.src || [];

    expect(srcProtocols).toContain("asset");
    expect(srcProtocols).toContain("attachment");
    expect(srcProtocols).toContain("app-file");
    expect(srcProtocols).toContain("data");
    expect(srcProtocols).toContain("blob");
    expect(hrefProtocols).not.toContain("asset");
    expect(hrefProtocols).not.toContain("file");
    expect(srcProtocols).not.toContain("file");
    expect(srcProtocols).not.toContain("app");
  });
});
