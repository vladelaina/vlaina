import { describe, expect, it } from "vitest";
import { readonlyMarkdownUrlTransform } from "./urlTransform";

describe("readonlyMarkdownUrlTransform", () => {
  it("returns the normalized safe image source", () => {
    expect(readonlyMarkdownUrlTransform("  https://example.com/image.png  ", "src", { tagName: "img" })).toBe("https://example.com/image.png");
    expect(readonlyMarkdownUrlTransform(".notes/public.png", "src", { tagName: "img" })).toBe(".notes/public.png");
    expect(readonlyMarkdownUrlTransform("  javascript:alert(1)  ", "src", { tagName: "img" })).toBe("");
    expect(readonlyMarkdownUrlTransform(".vlaina/secret.png", "src", { tagName: "img" })).toBe("");
    expect(readonlyMarkdownUrlTransform("docs/.git/secret.png", "src", { tagName: "img" })).toBe("");
    expect(readonlyMarkdownUrlTransform("docs/%252egit/secret.png", "src", { tagName: "img" })).toBe("");
  });

  it("keeps safe raw media source URLs without applying image-extension rules", () => {
    expect(readonlyMarkdownUrlTransform("xxx.mp4", "src", { tagName: "video" })).toBe("xxx.mp4");
    expect(readonlyMarkdownUrlTransform("./audio/demo.mp3", "src", { tagName: "audio" })).toBe("./audio/demo.mp3");
    expect(readonlyMarkdownUrlTransform("captions.vtt", "src", { tagName: "track" })).toBe("captions.vtt");
    expect(readonlyMarkdownUrlTransform(".notes/movie.mp4", "src", { tagName: "video" })).toBe(".notes/movie.mp4");
    expect(readonlyMarkdownUrlTransform("https://example.com/embed", "src", { tagName: "iframe" })).toBe("https://example.com/embed");
    expect(readonlyMarkdownUrlTransform("//example.com/embed", "src", { tagName: "iframe" })).toBe("https://example.com/embed");
    expect(readonlyMarkdownUrlTransform("https:example.com/embed", "src", { tagName: "iframe" })).toBe("");
    expect(readonlyMarkdownUrlTransform("http:/example.com/embed", "src", { tagName: "iframe" })).toBe("");
    expect(readonlyMarkdownUrlTransform("#self", "src", { tagName: "iframe" })).toBe("");
    expect(readonlyMarkdownUrlTransform("?embed", "src", { tagName: "iframe" })).toBe("");
    expect(readonlyMarkdownUrlTransform("embed.html", "src", { tagName: "iframe" })).toBe("");
    expect(readonlyMarkdownUrlTransform("./embed.html", "src", { tagName: "iframe" })).toBe("");
    expect(readonlyMarkdownUrlTransform("javascript:alert(1)", "src", { tagName: "video" })).toBe("");
    expect(readonlyMarkdownUrlTransform("https:example.com/movie.mp4", "src", { tagName: "video" })).toBe("");
    expect(readonlyMarkdownUrlTransform("http://127.0.0.1:3000/media.mp4", "src", { tagName: "video" })).toBe("");
    expect(readonlyMarkdownUrlTransform("/admin", "src", { tagName: "iframe" })).toBe("");
    expect(readonlyMarkdownUrlTransform(".vlaina/movie.mp4", "src", { tagName: "video" })).toBe("");
    expect(readonlyMarkdownUrlTransform("docs/.git/movie.mp4", "src", { tagName: "source" })).toBe("");
    expect(readonlyMarkdownUrlTransform("docs/%252egit/captions.vtt", "src", { tagName: "track" })).toBe("");
  });

  it("filters poster URLs like image sources", () => {
    expect(readonlyMarkdownUrlTransform("https://example.com/poster.png", "poster")).toBe("https://example.com/poster.png");
    expect(readonlyMarkdownUrlTransform(".notes/poster.png", "poster")).toBe(".notes/poster.png");
    expect(readonlyMarkdownUrlTransform("http://127.0.0.1:3000/poster.png", "poster")).toBe("");
    expect(readonlyMarkdownUrlTransform("/etc/passwd", "poster")).toBe("");
    expect(readonlyMarkdownUrlTransform(".vlaina/poster.png", "poster")).toBe("");
    expect(readonlyMarkdownUrlTransform("docs/.git/poster.png", "poster")).toBe("");
  });

  it("rejects protocol-relative links", () => {
    expect(readonlyMarkdownUrlTransform("//example.com/path", "href")).toBe("");
    expect(readonlyMarkdownUrlTransform("http://127.0.0.1:3000/path", "href")).toBe("");
    expect(readonlyMarkdownUrlTransform("http://router/path", "href")).toBe("");
    expect(readonlyMarkdownUrlTransform("https://example.com/path", "href")).toBe("https://example.com/path");
    expect(readonlyMarkdownUrlTransform("https:example.com/path", "href")).toBe("");
    expect(readonlyMarkdownUrlTransform("http:/example.com/path", "href")).toBe("");
    expect(readonlyMarkdownUrlTransform("docs/alpha.md", "href")).toBe("docs/alpha.md");
    expect(readonlyMarkdownUrlTransform(".notes/alpha.md", "href")).toBe(".notes/alpha.md");
    expect(readonlyMarkdownUrlTransform(".vlaina/workspace.md", "href")).toBe("");
    expect(readonlyMarkdownUrlTransform("docs/.git/config.md", "href")).toBe("");
    expect(readonlyMarkdownUrlTransform("docs/%252egit/config.md", "href")).toBe("");
  });

  it("filters cite URLs like links", () => {
    expect(readonlyMarkdownUrlTransform("https://example.com/source", "cite")).toBe("https://example.com/source");
    expect(readonlyMarkdownUrlTransform("http://127.0.0.1:3000/source", "cite")).toBe("");
    expect(readonlyMarkdownUrlTransform("//example.com/source", "cite")).toBe("");
    expect(readonlyMarkdownUrlTransform("javascript:alert(1)", "cite")).toBe("");
    expect(readonlyMarkdownUrlTransform(".vlaina/source.md", "cite")).toBe("");
    expect(readonlyMarkdownUrlTransform("docs/%252egit/source.md", "cite")).toBe("");
    expect(readonlyMarkdownUrlTransform(".notes/source.md", "cite")).toBe(".notes/source.md");
  });
});
