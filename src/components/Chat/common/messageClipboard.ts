const IMAGE_MARKDOWN_REGEX = /!\[[^\]]*]\(([^)]+)\)/g;

function normalizeImageMarkdownTarget(rawTarget: string): string | null {
  const trimmed = rawTarget.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    const wrapped = trimmed.slice(1, -1).trim();
    return wrapped || null;
  }

  const firstSegment = trimmed.split(/\s+/)[0]?.trim();
  return firstSegment || null;
}

export function extractMarkdownImageSources(content: string): string[] {
  const result: string[] = [];
  for (const match of content.matchAll(IMAGE_MARKDOWN_REGEX)) {
    const normalized = normalizeImageMarkdownTarget(match[1] || "");
    if (normalized) {
      result.push(normalized);
    }
  }
  return result;
}

export function formatMessageCopyText(content: string): string {
  return content.replace(IMAGE_MARKDOWN_REGEX, (_, rawTarget: string) => {
    const normalized = normalizeImageMarkdownTarget(rawTarget);
    if (!normalized) {
      return "";
    }
    return normalized.startsWith("data:image/") ? "[image]" : normalized;
  });
}

export async function copyImageSourceToClipboard(src: string): Promise<boolean> {
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const ClipboardItemCtor = (window as any).ClipboardItem;
    if (ClipboardItemCtor && blob.type.startsWith("image/")) {
      const item = new ClipboardItemCtor({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {
  }
  return false;
}

export async function copyMessageContentToClipboard(content: string): Promise<void> {
  const imageSources = extractMarkdownImageSources(content);
  if (imageSources.length > 0) {
    const copied = await copyImageSourceToClipboard(imageSources[0]);
    if (copied) {
      return;
    }
  }

  await navigator.clipboard.writeText(formatMessageCopyText(content));
}
