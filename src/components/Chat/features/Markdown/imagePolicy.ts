import { defaultSchema } from "rehype-sanitize";

const IMAGE_PROTOCOL_WHITELIST = new Set([
  "http:",
  "https:",
  "data:",
  "blob:",
  "asset:",
]);

const RELATIVE_PREFIXES = ["/", "./", "../"];

function isRelativePath(value: string): boolean {
  return RELATIVE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function isAllowedAssetUrl(url: URL): boolean {
  if (url.protocol !== "asset:") {
    return false;
  }

  const hostname = url.hostname.trim().toLowerCase();
  if (hostname !== "localhost" && hostname !== "asset.localhost") {
    return false;
  }

  return url.pathname.trim().length > 1;
}

export function normalizeRenderableImageSrc(src: string | null | undefined): string | null {
  if (!src) {
    return null;
  }

  const trimmed = src.trim();
  if (!trimmed) {
    return null;
  }

  if (/\s/.test(trimmed)) {
    return null;
  }

  if (isRelativePath(trimmed)) {
    return trimmed;
  }

  try {
    const base = typeof window !== "undefined" ? window.location.href : "http://localhost";
    const parsed = new URL(trimmed, base);
    if (parsed.protocol === "asset:") {
      return isAllowedAssetUrl(parsed) ? trimmed : null;
    }
    if (!IMAGE_PROTOCOL_WHITELIST.has(parsed.protocol)) {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

export function createMarkdownSanitizeSchema() {
  const protocols = (defaultSchema.protocols || {}) as Record<string, string[]>;
  const hrefProtocols = protocols.href || [];
  const srcProtocols = protocols.src || [];

  return {
    ...defaultSchema,
    protocols: {
      ...protocols,
      href: Array.from(new Set([...hrefProtocols, "tel"])),
      src: Array.from(new Set([...srcProtocols, "http", "https", "data", "blob", "asset"])),
    },
  };
}
