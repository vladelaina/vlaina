import React from 'react';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { useAccountSessionStore } from '@/stores/accountSession';
import { cn } from '@/lib/utils';
import { getSidebarIdleRowSurfaceClass } from './sidebar/sidebarLabelStyles';

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
        className={cn(
          'group inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 px-2.5 py-2 text-[16px] font-medium shadow-none transition-colors hover:shadow-none active:scale-[0.985]',
          getSidebarIdleRowSurfaceClass('chat'),
          'text-[var(--vlaina-color-brand-pink)] hover:bg-[var(--chat-sidebar-row-hover)]'
        )}
      >
        <span>ヾ(๑╹ヮ╹๑)ﾉ {signInLabel}</span>
        <Icon
          name="nav.arrowRight"
          size="sm"
          className="text-[var(--vlaina-color-brand-pink)] transition-transform duration-200 ease-out group-hover:translate-x-1"
        />
      </button>
      <div className="mx-2 mt-2 h-[1px] bg-[var(--vlaina-border)] opacity-40" />
    </div>
  );
};
