import { getExternalLinkProps } from "@/lib/navigation/externalLinks";
import { SignInPromptPill } from './SignInPromptPill';
import { Icon } from "@/components/ui/icons";
import { openExternalHref } from "@/lib/navigation/externalLinks";

interface ErrorBlockProps {
  type?: string;
  code?: string;
  content: string;
  showLoginPrompt?: boolean;
  showBillingPrompt?: boolean;
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

export function ErrorBlock({ content, showLoginPrompt = false, showBillingPrompt = false }: ErrorBlockProps) {
  if (showLoginPrompt) {
    return (
      <div className="w-full mb-2" data-no-focus-input="true">
        <SignInPromptPill />
      </div>
    );
  }

  return (
    <div className="w-full mb-2" data-no-focus-input="true">
      <div
        data-no-focus-input="true"
        className="text-sm text-[#f08aa6] opacity-90 leading-relaxed select-text whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
      >
        {renderWithLinks(content)}
      </div>
      {showBillingPrompt && (
        <button
          type="button"
          onClick={() => void openExternalHref('https://vlaina.com/pricing')}
          data-no-focus-input="true"
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-2xl bg-zinc-950 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <Icon name="misc.crown" size="sm" />
          购买会员
        </button>
      )}
    </div>
  );
}
