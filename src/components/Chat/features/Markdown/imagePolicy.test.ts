import { describe, expect, it } from "vitest";
import { createMarkdownSanitizeSchema, normalizeRenderableImageSrc } from "./imagePolicy";

describe("normalizeRenderableImageSrc", () => {
  it("allows common renderable image schemes", () => {
    expect(normalizeRenderableImageSrc("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(normalizeRenderableImageSrc("http://example.com/a.png")).toBe("http://example.com/a.png");
    expect(normalizeRenderableImageSrc("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    expect(normalizeRenderableImageSrc("blob:https://example.com/id")).toBe("blob:https://example.com/id");
    expect(normalizeRenderableImageSrc("asset://localhost/image.png")).toBe("asset://localhost/image.png");
    expect(normalizeRenderableImageSrc("file:///tmp/image.png")).toBe("file:///tmp/image.png");
  });

  it("allows relative image paths", () => {
    expect(normalizeRenderableImageSrc("/images/a.png")).toBe("/images/a.png");
    expect(normalizeRenderableImageSrc("./images/a.png")).toBe("./images/a.png");
    expect(normalizeRenderableImageSrc("../images/a.png")).toBe("../images/a.png");
  });

  it("rejects dangerous and invalid protocols", () => {
    expect(normalizeRenderableImageSrc("javascript:alert(1)")).toBeNull();
    expect(normalizeRenderableImageSrc("vbscript:msgbox(1)")).toBeNull();
    expect(normalizeRenderableImageSrc("")).toBeNull();
    expect(normalizeRenderableImageSrc("   ")).toBeNull();
    expect(normalizeRenderableImageSrc("not a url")).toBeNull();
  });
});

describe("createMarkdownSanitizeSchema", () => {
  it("extends sanitize protocols to include local image schemes", () => {
    const schema = createMarkdownSanitizeSchema();
    const hrefProtocols = schema.protocols?.href || [];
    const srcProtocols = schema.protocols?.src || [];

    expect(hrefProtocols).toContain("asset");
    expect(hrefProtocols).toContain("file");
    expect(srcProtocols).toContain("asset");
    expect(srcProtocols).toContain("file");
    expect(srcProtocols).toContain("data");
    expect(srcProtocols).toContain("blob");
  });
});
