import type { ReactNode } from "react";
import { getExternalLinkProps, normalizeExternalHref, openExternalHref } from "@/lib/navigation/externalLinks";
import { SignInPromptPill } from './SignInPromptPill';
import { Icon } from "@/components/ui/icons";
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
  const urlRegex = /https?:\/\/[^\s]+/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
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
    lastIndex = match.index + url.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
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
        data-chat-selection-surface="true"
        data-chat-selection-start="true"
        className="text-sm text-[var(--vlaina-color-brand-pink)] opacity-[var(--vlaina-opacity-90)] leading-relaxed select-text whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
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
            "group mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-medium text-[var(--vlaina-sidebar-chat-text)] transition-all duration-[var(--vlaina-duration-200)] active:scale-[var(--vlaina-scale-985)]",
            chatComposerPillSurfaceClass
          )}
        >
          <span>继续使用</span>
          <Icon
            name="nav.arrowRight"
            size="sm"
            className="text-[var(--vlaina-sidebar-chat-text-soft)] transition-transform duration-[var(--vlaina-duration-200)] ease-out group-hover:translate-x-1"
          />
        </button>
      )}
    </div>
  );
}
