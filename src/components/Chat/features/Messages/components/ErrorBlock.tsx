import { getExternalLinkProps } from "@/lib/navigation/externalLinks";
import { SignInPromptPill } from './SignInPromptPill';
import { Icon } from "@/components/ui/icons";
import { openExternalHref } from "@/lib/navigation/externalLinks";
import { markBillingReturnRefreshPending } from "@/lib/billing/returnRefresh";
import { chatComposerPillSurfaceClass } from "@/components/Chat/features/Input/composerStyles";
import { cn } from "@/lib/utils";

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
          onClick={() => {
            markBillingReturnRefreshPending();
            void openExternalHref('https://vlaina.com/r/spark_continue');
          }}
          data-no-focus-input="true"
          className={cn(
            "group mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-medium text-[var(--chat-sidebar-text)] transition-all duration-200 active:scale-[0.985]",
            chatComposerPillSurfaceClass
          )}
        >
          <span>继续使用</span>
          <Icon
            name="nav.arrowRight"
            size="sm"
            className="text-[var(--chat-sidebar-text-soft)] transition-transform duration-200 ease-out group-hover:translate-x-1"
          />
        </button>
      )}
    </div>
  );
}
