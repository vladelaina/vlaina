import React from 'react';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { useAccountSessionStore } from '@/stores/accountSession';
import { cn } from '@/lib/utils';
import { getSidebarIdleRowSurfaceClass } from './sidebar/sidebarLabelStyles';
import { themeStyleResetTokens } from '@/styles/themeTokens';

interface LoginPromptProps {
  onOpenDialog: () => void;
}

export const LoginPrompt: React.FC<LoginPromptProps> = ({ onOpenDialog }) => {
  const { isConnecting } = useAccountSessionStore();
  const { t } = useI18n();
  const signInLabel = isConnecting ? t('account.continueSignIn') : t('account.signIn');

  return (
    <div className="p-2 pb-0">
      <button
        type="button"
        onClick={onOpenDialog}
        style={{ boxShadow: themeStyleResetTokens.boxShadowNone }}
        className={cn(
          'group inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 px-2.5 py-2 text-[var(--vlaina-font-base)] font-medium !shadow-[var(--vlaina-shadow-none)] transition-colors hover:!shadow-[var(--vlaina-shadow-none)] active:scale-[var(--vlaina-scale-985)]',
          getSidebarIdleRowSurfaceClass('chat'),
          'text-[var(--vlaina-color-brand-pink)] hover:bg-[var(--vlaina-sidebar-chat-row-hover)]'
        )}
      >
        <span>ヾ(๑╹ヮ╹๑)ﾉ {signInLabel}</span>
        <Icon
          name="nav.arrowRight"
          size="sm"
          className="text-[var(--vlaina-color-brand-pink)] transition-transform duration-[var(--vlaina-duration-200)] ease-out group-hover:translate-x-1"
        />
      </button>
      <div className="mx-2 mt-2 h-[var(--vlaina-size-1px)] bg-[var(--vlaina-border)] opacity-[var(--vlaina-opacity-40)]" />
    </div>
  );
};
