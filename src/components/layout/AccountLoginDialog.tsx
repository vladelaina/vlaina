import React from 'react';
import { AccountSignInOptions } from '@/components/account/AccountSignInOptions';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icons';
import { useAccountSessionStore } from '@/stores/accountSession';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface AccountLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountLoginDialog({ open, onOpenChange }: AccountLoginDialogProps) {
  const { isConnecting, error, signIn, requestEmailCode, verifyEmailCode, cancelConnect, clearError } =
    useAccountSessionStore();
  const { t } = useI18n();
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        clearError();
      }
      onOpenChange(nextOpen);
    },
    [clearError, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        useBlurBackdrop
        containerClassName="z-[1001]"
        blurBackdropProps={{ 
          overlayClassName: 'bg-zinc-950/20 backdrop-blur-sm', 
          zIndex: 1000,
          blurPx: 8, 
          duration: 0.05 
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          closeButtonRef.current?.focus();
        }}
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
        className={cn(
          "w-full max-w-[min(460px,calc(100vw-1.5rem))] border-none p-0 overflow-visible bg-transparent shadow-none select-none",
          "transition-all duration-75 ease-in-out"
        )}
      >
        <DialogTitle className="sr-only">{t('account.signInTitle')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('account.signInDescription')}
        </DialogDescription>
        <div className={cn(
          "relative w-full rounded-[36px] px-5 py-6 sm:rounded-[48px] sm:px-8 sm:py-9 md:rounded-[56px] md:p-12",
          chatComposerPillSurfaceClass
        )}>
          <DialogClose
            ref={closeButtonRef}
            className={cn(
              "absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-all hover:text-zinc-950 sm:right-5 sm:top-5 dark:text-zinc-500 dark:hover:text-zinc-950",
              "hover:bg-zinc-100 dark:hover:bg-zinc-100"
            )}
          >
            <Icon name="common.close" size="md" />
          </DialogClose>

          <div className="mb-7 flex items-center justify-center text-center sm:mb-10 md:mb-12">
            <h2 className="text-[24px] font-black leading-none tracking-tight text-zinc-950 sm:text-[26px] md:text-[28px]">
              {t('account.signIn')}
            </h2>
          </div>

          <div className="w-full">
            <AccountSignInOptions
              variant="panel"
              isConnecting={isConnecting}
              error={error}
              onOauthSignIn={signIn}
              onEmailCodeRequest={requestEmailCode}
              onEmailCodeVerify={verifyEmailCode}
            />
          </div>

          {isConnecting && (
            <div className="mt-8 text-center animate-in fade-in duration-500">
              <button
                type="button"
                onClick={() => cancelConnect()}
                className="text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {t('account.cancelAuthentication')}
              </button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
