import type { ReactNode } from "react";
import { getExternalLinkProps, normalizeExternalHref } from "@/lib/navigation/externalLinks";

interface ErrorBlockProps {
  type?: string;
  code?: string;
  content: string;
}

const MAX_ERROR_LINKS = 50;

const renderWithLinks = (text: string) => {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let linkedUrls = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    if (linkedUrls >= MAX_ERROR_LINKS) {
      break;
    }

    const url = match[0];
    const safeHref = normalizeExternalHref(url);
    if (!safeHref) {
      continue;
    }

    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={`${match.index}-${url}`}
        {...getExternalLinkProps(url)}
        data-no-focus-input="true"
        className="underline break-all"
      >
        {url}
      </a>
    );
    linkedUrls += 1;
    lastIndex = match.index + url.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

export function ErrorBlock({ content }: ErrorBlockProps) {
  return (
    <div className="w-full mb-2" data-no-focus-input="true">
      <div
        data-no-focus-input="true"
        data-chat-selection-surface="true"
        data-chat-selection-start="true"
        className="text-sm text-[var(--vlaina-color-brand-pink)] opacity-[var(--vlaina-opacity-90)] leading-relaxed select-text whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
      >
        {renderWithLinks(content)}
      </div>
    </div>
  );
}
