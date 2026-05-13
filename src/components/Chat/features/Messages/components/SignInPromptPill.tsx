import { Icon } from '@/components/ui/icons';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { ACCOUNT_LOGIN_REQUESTED_EVENT } from '@/lib/account/sessionEvent';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

export function SignInPromptPill() {
  const { t } = useI18n();

  return (
    <button
      type="button"
      data-no-focus-input="true"
      onClick={() => {
        window.dispatchEvent(new Event(ACCOUNT_LOGIN_REQUESTED_EVENT));
      }}
      className={cn(
        'group inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-medium text-[var(--chat-sidebar-text)] transition-all duration-200 active:scale-[0.985]',
        chatComposerPillSurfaceClass
      )}
    >
      <span>{t('chat.signInPrompt')}</span>
      <Icon
        name="nav.arrowRight"
        size="sm"
        className="text-[var(--chat-sidebar-text-soft)] transition-transform duration-200 ease-out group-hover:translate-x-1"
      />
    </button>
  );
}
