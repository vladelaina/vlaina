import React from 'react';
import { AccountSignInOptions } from '@/components/account/AccountSignInOptions';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icons';
import { useAccountSessionStore } from '@/stores/accountSession';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { themeBackdropTokens } from '@/styles/themeTokens';

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
        containerClassName="z-[var(--vlaina-z-1001)]"
        blurBackdropProps={{
          overlayClassName: 'bg-[var(--vlaina-color-backdrop-soft)] backdrop-blur-[var(--vlaina-backdrop-blur-sm)]',
          zIndex: themeBackdropTokens.accountDialogZIndex,
          blurPx: themeBackdropTokens.accountDialogBlurPx,
          duration: themeBackdropTokens.accountDialogDurationSeconds,
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
          "w-full max-w-[var(--vlaina-width-account-dialog-max)] border-none p-0 overflow-visible bg-transparent shadow-[var(--vlaina-shadow-none)] select-none",
          "transition-all duration-[var(--vlaina-duration-75)] ease-in-out"
        )}
      >
        <DialogTitle className="sr-only">{t('account.signInTitle')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('account.signInDescription')}
        </DialogDescription>
        <div className={cn(
          "relative w-full rounded-[var(--vlaina-radius-36px)] px-5 py-6 sm:rounded-[var(--vlaina-radius-48px)] sm:px-8 sm:py-9 md:rounded-[var(--vlaina-radius-56px)] md:p-12",
          chatComposerPillSurfaceClass
        )}>
          <DialogClose
            ref={closeButtonRef}
            className={cn(
              "absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--vlaina-sidebar-notes-text-soft)] transition-all hover:text-[var(--vlaina-color-text-strong)] sm:right-5 sm:top-5",
              "hover:bg-[var(--vlaina-hover-filled)]"
            )}
          >
            <Icon name="common.close" size="md" />
          </DialogClose>

          <div className="mb-7 flex items-center justify-center text-center sm:mb-10 md:mb-12">
            <h2 className="text-[var(--vlaina-font-24)] font-black leading-none tracking-tight text-[var(--vlaina-color-text-strong)] sm:text-[var(--vlaina-font-26)] md:text-[var(--vlaina-font-28)]">
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
            <div className="mt-8 text-center animate-in fade-in duration-[var(--vlaina-duration-500)]">
              <button
                type="button"
                onClick={() => cancelConnect()}
                className="text-[var(--vlaina-font-11)] font-black uppercase tracking-widest text-[var(--vlaina-sidebar-notes-text-soft)] hover:text-[var(--vlaina-color-text-strong)] transition-colors"
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
