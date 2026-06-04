import { describe, expect, it } from "vitest";
import { readonlyMarkdownUrlTransform } from "./urlTransform";

describe("readonlyMarkdownUrlTransform", () => {
  it("returns the normalized safe image source", () => {
    expect(readonlyMarkdownUrlTransform("  https://example.com/image.png  ", "src")).toBe("https://example.com/image.png");
    expect(readonlyMarkdownUrlTransform("  javascript:alert(1)  ", "src")).toBe("");
  });

  it("filters poster URLs like image sources", () => {
    expect(readonlyMarkdownUrlTransform("https://example.com/poster.png", "poster")).toBe("https://example.com/poster.png");
    expect(readonlyMarkdownUrlTransform("http://127.0.0.1:3000/poster.png", "poster")).toBe("");
    expect(readonlyMarkdownUrlTransform("/etc/passwd", "poster")).toBe("");
  });

  it("rejects protocol-relative links", () => {
    expect(readonlyMarkdownUrlTransform("//example.com/path", "href")).toBe("");
    expect(readonlyMarkdownUrlTransform("docs/alpha.md", "href")).toBe("docs/alpha.md");
  });

  it("filters cite URLs like links", () => {
    expect(readonlyMarkdownUrlTransform("https://example.com/source", "cite")).toBe("https://example.com/source");
    expect(readonlyMarkdownUrlTransform("//example.com/source", "cite")).toBe("");
    expect(readonlyMarkdownUrlTransform("javascript:alert(1)", "cite")).toBe("");
  });
});
