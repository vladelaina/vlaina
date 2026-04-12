import { getExternalLinkProps } from "@/lib/navigation/externalLinks";

interface ErrorBlockProps {
  type?: string;
  code?: string;
  content: string;
}

const renderWithLinks = (text: string) => {
  const urlRegex =
    /(https?:\/\/(?!127\.|localhost|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)[^\s]+)/g;

  const urls: string[] = [];
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    urls.push(match[0]);
  }

  urlRegex.lastIndex = 0;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urls.includes(part)) {
      return (
        <a
          key={`${index}-${part}`}
          {...getExternalLinkProps(part)}
          data-no-focus-input="true"
          className="underline break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export function ErrorBlock({ content }: ErrorBlockProps) {
  return (
    <div className="w-full mb-2" data-no-focus-input="true">
      <div
        data-no-focus-input="true"
        className="text-sm text-neutral-500 dark:text-neutral-500 opacity-90 leading-relaxed select-text whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
      >
        {renderWithLinks(content)}
      </div>
    </div>
  );
}
