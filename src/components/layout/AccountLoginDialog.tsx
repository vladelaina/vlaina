import React from 'react';
import { AccountSignInOptions } from '@/components/account/AccountSignInOptions';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icons';
import { useAccountSessionStore } from '@/stores/accountSession';
import { cn } from '@/lib/utils';

interface AccountLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountLoginDialog({ open, onOpenChange }: AccountLoginDialogProps) {
  const { isConnecting, error, signIn, requestEmailCode, verifyEmailCode, cancelConnect, clearError } =
    useAccountSessionStore();

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
        blurBackdropProps={{ 
          overlayClassName: 'bg-zinc-950/20 backdrop-blur-sm', 
          blurPx: 8, 
          duration: 0.4 
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        className={cn(
          "w-full max-w-[min(460px,calc(100vw-1.5rem))] border-none p-0 overflow-visible bg-transparent shadow-none select-none",
          "transition-all duration-700 ease-in-out"
        )}
      >
        {/* Ceramic Pro Shell */}
        <div className={cn(
          "relative w-full rounded-[36px] px-5 py-6 sm:rounded-[48px] sm:px-8 sm:py-9 md:rounded-[64px] md:p-14",
          "bg-white dark:bg-zinc-900",
          "shadow-[0_40px_100px_rgba(0,0,0,0.06),inset_0_0_20px_rgba(255,255,255,1)] dark:shadow-[0_40px_120px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)]",
          "border border-white dark:border-zinc-800"
        )}>
          
          {/* Subtle Close Button - Minimalist */}
          <DialogClose className="absolute right-5 top-5 inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 transition-all hover:text-zinc-950 hover:bg-zinc-50 sm:right-7 sm:top-7 md:right-10 md:top-10 dark:text-zinc-600 dark:hover:text-white dark:hover:bg-white/5">
            <Icon name="common.close" size="md" />
          </DialogClose>

          {/* Minimalist Heading - Director's Choice */}
          <div className="mb-7 flex flex-col items-center gap-1.5 text-center sm:mb-10 sm:gap-2 md:mb-14">
             <h2 className="text-[24px] leading-none font-black tracking-tight text-zinc-950 sm:text-[26px] md:text-[28px] dark:text-white">Sign In</h2>
             <p className="text-[13px] font-medium text-zinc-400 sm:text-[14px]">Continue to NekoTick</p>
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
                Cancel Authentication
              </button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
