import { defaultSchema } from "rehype-sanitize";

const IMAGE_PROTOCOL_WHITELIST = new Set([
  "http:",
  "https:",
  "data:",
  "blob:",
  "asset:",
  "file:",
  "tauri:",
  "app:",
]);

const RELATIVE_PREFIXES = ["/", "./", "../"];

function isRelativePath(value: string): boolean {
  return RELATIVE_PREFIXES.some((prefix) => value.startsWith(prefix));
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
      href: Array.from(new Set([...hrefProtocols, "tel", "asset", "file", "tauri", "app"])),
      src: Array.from(new Set([...srcProtocols, "http", "https", "data", "blob", "asset", "file", "tauri", "app"])),
    },
  };
}
