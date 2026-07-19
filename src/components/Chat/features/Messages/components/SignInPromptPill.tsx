import { Icon } from '@/components/ui/icons';
import { raisedPillSurfaceClass } from '@/components/ui/surfaceStyles';
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
        'group inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-medium text-[var(--vlaina-color-brand-pink)] transition-all duration-[var(--vlaina-duration-200)] active:scale-[var(--vlaina-scale-985)]',
        raisedPillSurfaceClass
      )}
    >
      <span>{t('chat.signInPrompt')}</span>
      <Icon
        name="nav.arrowRight"
        size="sm"
        className="text-[var(--vlaina-color-brand-pink)] transition-transform duration-[var(--vlaina-duration-200)] ease-out group-hover:translate-x-1"
      />
    </button>
  );
}
