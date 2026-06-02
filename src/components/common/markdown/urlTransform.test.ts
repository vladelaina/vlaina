import { describe, expect, it } from "vitest";
import { readonlyMarkdownUrlTransform } from "./urlTransform";

describe("readonlyMarkdownUrlTransform", () => {
  it("returns the normalized safe image source", () => {
    expect(readonlyMarkdownUrlTransform("  https://example.com/image.png  ", "src")).toBe("https://example.com/image.png");
    expect(readonlyMarkdownUrlTransform("  javascript:alert(1)  ", "src")).toBe("");
  });

  it("rejects protocol-relative links", () => {
    expect(readonlyMarkdownUrlTransform("//example.com/path", "href")).toBe("");
    expect(readonlyMarkdownUrlTransform("docs/alpha.md", "href")).toBe("docs/alpha.md");
  });
});
