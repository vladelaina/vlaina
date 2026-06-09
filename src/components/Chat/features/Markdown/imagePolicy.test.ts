import { describe, expect, it } from "vitest";
import { createMarkdownSanitizeSchema, isRenderableDataImageSrc, normalizeRenderableImageSrc, normalizeRenderableImageSrcset } from "./imagePolicy";
import { MAX_INLINE_IMAGE_BYTES } from "@/lib/markdown/dataImagePolicy";
import { rehypeImageSrcSanitizer, rehypeImageSrcsetSanitizer } from "@/components/common/markdown/imagePolicy";
import {
  GITHUB_ALLOWED_ATTRIBUTES_BY_TAG,
  GITHUB_ALLOWED_HTML_TAGS,
} from "@/lib/notes/markdown/githubHtmlPolicy";

function createOversizedDataImageSrc(): string {
  const payload = "A".repeat(Math.ceil((MAX_INLINE_IMAGE_BYTES + 1) / 3) * 4);
  return `data:image/png;base64,${payload}`;
}

function createDataImageSrc(payloadChars: number): string {
  return `data:image/png;base64,${"A".repeat(payloadChars)}`;
}

function createDeepHastTree(leaf: any): any {
  let current = leaf;

  for (let index = 0; index < 205; index += 1) {
    current = {
      type: "element",
      tagName: "div",
      children: [current],
    };
  }

  return {
    type: "root",
    children: [current],
  };
}

const HAST_ATTRIBUTE_NAME_BY_HTML_ATTRIBUTE: Record<string, string> = {
  "accept-charset": "acceptCharset",
  allowfullscreen: "allowFullScreen",
  allowtransparency: "allowTransparency",
  charoff: "charOff",
  charset: "charSet",
  colspan: "colSpan",
  datetime: "dateTime",
  enctype: "encType",
  for: "htmlFor",
  frameborder: "frameBorder",
  hreflang: "hrefLang",
  hspace: "hSpace",
  ismap: "isMap",
  itemprop: "itemProp",
  itemscope: "itemScope",
  itemtype: "itemType",
  longdesc: "longDesc",
  maxlength: "maxLength",
  nohref: "noHref",
  noshade: "noShade",
  nowrap: "noWrap",
  playsinline: "playsInline",
  readonly: "readOnly",
  referrerpolicy: "referrerPolicy",
  rowspan: "rowSpan",
  srclang: "srcLang",
  srcset: "srcSet",
  tabindex: "tabIndex",
  usemap: "useMap",
  valign: "vAlign",
};

function toHastAttributeName(attributeName: string): string {
  return HAST_ATTRIBUTE_NAME_BY_HTML_ATTRIBUTE[attributeName] ?? attributeName.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function getSchemaAttributeNames(attributes: Array<string | [string, ...unknown[]]> | undefined): Set<string> {
  return new Set((attributes || []).map((attribute) => Array.isArray(attribute) ? attribute[0] : attribute));
}

describe("normalizeRenderableImageSrc", () => {
  it("allows common renderable image schemes", () => {
    expect(normalizeRenderableImageSrc("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(normalizeRenderableImageSrc("http://example.com/a.png")).toBe("http://example.com/a.png");
    expect(normalizeRenderableImageSrc("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    expect(normalizeRenderableImageSrc("DATA:IMAGE/PNG;BASE64,abc")).toBe("data:image/png;base64,abc");
    expect(normalizeRenderableImageSrc("blob:https://example.com/id")).toBe("blob:https://example.com/id");
    expect(normalizeRenderableImageSrc("asset://localhost/chat-inline-image/0")).toBe("asset://localhost/chat-inline-image/0");
    expect(normalizeRenderableImageSrc("attachment://demo%20image.png")).toBe("attachment://demo%20image.png");
    expect(normalizeRenderableImageSrc("app-file://attachment/demo%20image.png")).toBe("app-file://attachment/demo%20image.png");
  });

  it("allows relative image paths", () => {
    expect(normalizeRenderableImageSrc("image.png")).toBe("image.png");
    expect(normalizeRenderableImageSrc("images/a.png")).toBe("images/a.png");
    expect(normalizeRenderableImageSrc("image one.png")).toBe("image one.png");
    expect(normalizeRenderableImageSrc("./images/a.png")).toBe("./images/a.png");
    expect(normalizeRenderableImageSrc("../images/a.png")).toBe("../images/a.png");
    expect(normalizeRenderableImageSrc(".notes/a.png")).toBe(".notes/a.png");
  });

  it("rejects dangerous and invalid protocols", () => {
    expect(normalizeRenderableImageSrc("javascript:alert(1)")).toBeNull();
    expect(normalizeRenderableImageSrc("vbscript:msgbox(1)")).toBeNull();
    expect(normalizeRenderableImageSrc("file:///tmp/image.png")).toBeNull();
    expect(normalizeRenderableImageSrc("/images/a.png")).toBeNull();
    expect(normalizeRenderableImageSrc("/etc/passwd")).toBeNull();
    expect(normalizeRenderableImageSrc("image\u0000.png")).toBeNull();
    expect(normalizeRenderableImageSrc("image\u202Egnp.exe")).toBeNull();
    expect(normalizeRenderableImageSrc("app://localhost/image.png")).toBeNull();
    expect(normalizeRenderableImageSrc("app-file://other/image.png")).toBeNull();
    expect(normalizeRenderableImageSrc("custom://localhost/image.png")).toBeNull();
    expect(normalizeRenderableImageSrc("asset://localhost/image.png")).toBeNull();
    expect(normalizeRenderableImageSrc("asset://asset.localhost/chat-inline-image/0")).toBeNull();
    expect(normalizeRenderableImageSrc("asset://localhost/chat-inline-image/not-a-number")).toBeNull();
    expect(normalizeRenderableImageSrc("asset://evilhost/image.png")).toBeNull();
    expect(normalizeRenderableImageSrc("")).toBeNull();
    expect(normalizeRenderableImageSrc("   ")).toBeNull();
    expect(normalizeRenderableImageSrc("not a url")).toBeNull();
    expect(normalizeRenderableImageSrc("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(normalizeRenderableImageSrc("data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+")).toBeNull();
    expect(normalizeRenderableImageSrc("data:image/png,not-base64")).toBeNull();
  });

  it("rejects relative image paths inside internal note folders", () => {
    expect(normalizeRenderableImageSrc(".vlaina/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("./.vlaina/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("docs/.git/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("docs/.GIT/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("%2evlaina/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("docs/%252egit/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc(".notes/public.png")).toBe(".notes/public.png");
  });

  it("rejects stored attachment URLs with nested or traversal filenames", () => {
    expect(normalizeRenderableImageSrc("attachment://../secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("attachment://%2e%2e%2fsecret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("attachment:///secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("app-file://attachment/folder/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("app-file://attachment/%2e%2e%2fsecret.png")).toBeNull();
  });

  it("rejects local-network remote image sources", () => {
    expect(normalizeRenderableImageSrc("http://localhost:3000/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://localhost./secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://assets.localhost/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://printer.local/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://router/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://100.64.0.1/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://198.18.0.1/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://127.0.0.1:3000/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("//127.0.0.1:3000/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://127.1/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://2130706433/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://192.168.1.8/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://[::ffff:7f00:1]/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://[::7f00:1]/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc("http://[::ffff:0:7f00:1]/secret.png")).toBeNull();
    expect(normalizeRenderableImageSrc(String.raw`http:\127.0.0.1\secret.png`)).toBeNull();
    expect(normalizeRenderableImageSrc(String.raw`\\127.0.0.1\secret.png`)).toBeNull();
    expect(normalizeRenderableImageSrc("https://example.com/safe.png")).toBe("https://example.com/safe.png");
    expect(normalizeRenderableImageSrc("https://[2606:4700:4700::1111]/safe.png")).toBe("https://[2606:4700:4700::1111]/safe.png");
  });

  it("detects renderable data image sources case-insensitively", () => {
    expect(isRenderableDataImageSrc("data:image/png;base64,abc")).toBe(true);
    expect(isRenderableDataImageSrc(" DATA:IMAGE/PNG;BASE64,abc ")).toBe(true);
    expect(isRenderableDataImageSrc("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isRenderableDataImageSrc("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
  });

  it("rejects oversized data image sources before rendering", () => {
    const oversizedSrc = createOversizedDataImageSrc();

    expect(isRenderableDataImageSrc(oversizedSrc)).toBe(false);
    expect(normalizeRenderableImageSrc(oversizedSrc)).toBeNull();
  });

  it("rejects oversized non-data image sources", () => {
    const oversizedSegment = "a".repeat(4097);

    expect(normalizeRenderableImageSrc(`https://example.com/${oversizedSegment}.png`)).toBeNull();
    expect(normalizeRenderableImageSrc(`images/${oversizedSegment}.png`)).toBeNull();
  });
});

describe("normalizeRenderableImageSrcset", () => {
  it("keeps safe srcset candidates", () => {
    expect(normalizeRenderableImageSrcset("images/a.webp 1x, https://example.com/a@2x.webp 2x")).toBe(
      "images/a.webp 1x, https://example.com/a@2x.webp 2x",
    );
    expect(normalizeRenderableImageSrcset("data:image/png;base64,abc 1x, DATA:IMAGE/WEBP;BASE64,def 2x")).toBe(
      "data:image/png;base64,abc 1x, data:image/webp;base64,def 2x",
    );
  });

  it("rejects unsafe srcset candidates", () => {
    expect(normalizeRenderableImageSrcset("//127.0.0.1:3000/secret.png 1x")).toBeNull();
    expect(normalizeRenderableImageSrcset("/images/a.webp 1x")).toBeNull();
    expect(normalizeRenderableImageSrcset("javascript:alert(1) 1x")).toBeNull();
    expect(normalizeRenderableImageSrcset("data:image/svg+xml;base64,PHN2Zz4= 1x")).toBeNull();
    expect(normalizeRenderableImageSrcset(`${createOversizedDataImageSrc()} 1x`)).toBeNull();
    expect(normalizeRenderableImageSrcset("https://example.com/a.webp 1x, http://192.168.1.8/secret.png 2x")).toBeNull();
    expect(normalizeRenderableImageSrcset(".vlaina/secret.webp 1x")).toBeNull();
    expect(normalizeRenderableImageSrcset("docs/%252egit/secret.webp 1x")).toBeNull();
  });

  it("allows data image srcset candidates above the ordinary srcset length limit", () => {
    const largeDataSrc = createDataImageSrc(70 * 1024);

    expect(normalizeRenderableImageSrcset(`${largeDataSrc} 1x`)).toBe(`${largeDataSrc} 1x`);
  });

  it("rejects oversized non-data srcset attributes", () => {
    const oversizedSrcset = Array.from({ length: 128 }, (_, index) => {
      return `https://example.com/${"a".repeat(480)}-${index}.webp 1x`;
    }).join(", ");

    expect(normalizeRenderableImageSrcset(oversizedSrcset)).toBeNull();
  });

  it("rejects srcset attributes with too many candidates", () => {
    const oversizedCandidateList = Array.from({ length: 129 }, (_, index) => {
      return `images/${index}.webp 1x`;
    }).join(", ");

    expect(normalizeRenderableImageSrcset(oversizedCandidateList)).toBeNull();
  });

  it("rejects srcset candidates with extra descriptors", () => {
    expect(normalizeRenderableImageSrcset("images/a.webp 1x 2x")).toBeNull();
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

  it("keeps the GitHub raw HTML tag and tag-specific attribute allowlist mapped to HAST names", () => {
    const schema = createMarkdownSanitizeSchema();
    const tagNames = new Set(schema.tagNames || []);
    const attributes = (schema.attributes || {}) as Record<string, Array<string | [string, ...unknown[]]>>;
    const globalAttributes = getSchemaAttributeNames(attributes["*"]);

    expect(Array.from(GITHUB_ALLOWED_HTML_TAGS).filter((tagName) => !tagNames.has(tagName))).toEqual([]);

    for (const [tagName, allowedAttributes] of Object.entries(GITHUB_ALLOWED_ATTRIBUTES_BY_TAG)) {
      const tagAttributes = getSchemaAttributeNames(attributes[tagName]);
      const missingAttributes = Array.from(allowedAttributes)
        .map(toHastAttributeName)
        .filter((attributeName) => !tagAttributes.has(attributeName) && !globalAttributes.has(attributeName));

      expect(missingAttributes, tagName).toEqual([]);
    }
  });
});

describe("rehype image sanitizers", () => {
  it("normalizes data image source attributes without recursive traversal", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "img",
          properties: { src: " DATA:IMAGE/PNG;BASE64,abc " },
        },
      ],
    };

    rehypeImageSrcSanitizer()(tree);

    expect(tree.children[0].properties.src).toBe("data:image/png;base64,abc");
  });

  it("removes unsafe srcset attributes without recursive traversal", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "source",
          properties: { srcset: "//127.0.0.1:3000/secret.png 1x" },
        },
      ],
    };

    rehypeImageSrcsetSanitizer()(tree);

    expect(tree.children[0].properties).not.toHaveProperty("srcset");
  });

  it("clips over-deep image policy HAST trees before leaving unvisited descendants", () => {
    const tree = createDeepHastTree({
      type: "element",
      tagName: "source",
      properties: { srcset: "//127.0.0.1:3000/secret.png 1x" },
    });

    rehypeImageSrcsetSanitizer()(tree);

    expect(JSON.stringify(tree)).not.toContain("127.0.0.1");
  });

  it("clips over-large image policy HAST sibling lists before leaving unvisited descendants", () => {
    const tree = {
      type: "root",
      children: Array.from({ length: 20_001 }, () => ({
        type: "element",
        tagName: "source",
        properties: { srcset: "//127.0.0.1:3000/secret.png 1x" },
      })),
    };

    rehypeImageSrcsetSanitizer()(tree);

    expect(tree.children.length).toBeLessThan(20_001);
    expect(JSON.stringify(tree)).not.toContain("127.0.0.1");
  });
});
