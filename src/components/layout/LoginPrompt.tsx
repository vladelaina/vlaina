import React from 'react';
import { Icon } from '@/components/ui/icons';
import { useAccountSessionStore } from '@/stores/accountSession';

interface LoginPromptProps {
  onOpenDialog: () => void;
}

export const LoginPrompt: React.FC<LoginPromptProps> = ({ onOpenDialog }) => {
  const { isConnecting } = useAccountSessionStore();

  return (
    <div className="p-2 pb-0">
      <button
        type="button"
        onClick={onOpenDialog}
        className="group inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-black/5 bg-[var(--vlaina-bg-primary)] px-4 text-[13px] font-medium text-[var(--vlaina-text-primary)] shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition-[border-color] duration-150 hover:border-black/8 active:scale-[0.985] dark:border-white/5 dark:shadow-[0_12px_24px_rgba(0,0,0,0.22)] dark:hover:border-white/10"
      >
        <span>{isConnecting ? 'Continue Sign In' : 'Sign In'}</span>
        <Icon
          name="nav.arrowRight"
          size="sm"
          className="opacity-70 transition-transform duration-200 ease-out group-hover:translate-x-1"
        />
      </button>
      <div className="mx-2 mt-2 h-[1px] bg-[var(--vlaina-border)] opacity-40" />
    </div>
  );
};
