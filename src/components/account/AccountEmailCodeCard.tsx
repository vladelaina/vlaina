import React, { useEffect, useRef, useState } from 'react';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface AccountEmailCodeCardProps {
  isCompact?: boolean;
  disabled?: boolean;
  onEmailCodeRequest: (email: string) => Promise<boolean>;
  onEmailCodeVerify: (email: string, code: string) => Promise<boolean>;
}

export function AccountEmailCodeCard({
  disabled,
  onEmailCodeRequest,
  onEmailCodeVerify,
}: AccountEmailCodeCardProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (step !== 'code' || disabled || isLoading) {
      return;
    }

    codeInputRef.current?.focus();
  }, [step, disabled, isLoading]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isLoading) return;
    setIsLoading(true);
    try {
      const success = await onEmailCodeRequest(email);
      if (success) setStep('code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || isLoading) return;
    setIsLoading(true);
    try {
      await onEmailCodeVerify(email, code);
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <form noValidate onSubmit={handleRequestCode} className="space-y-4 w-full">
        <input
          type="text"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('account.emailAddress')}
          disabled={disabled || isLoading}
          className={cn(
            "h-14 w-full rounded-full px-5 py-3 text-center text-[var(--vlaina-font-sm)] font-medium text-[var(--vlaina-color-text-strong)] transition-all duration-[var(--vlaina-duration-200)] outline-none sm:h-[var(--vlaina-size-60px)] sm:px-6 sm:py-3.5 sm:text-[var(--vlaina-font-15)] md:h-16",
            "placeholder:text-[var(--vlaina-sidebar-notes-text-soft)]",
            "focus:ring-2 focus:ring-[var(--vlaina-color-accent-focus-ring)]",
            "disabled:cursor-not-allowed disabled:opacity-[var(--vlaina-opacity-50)]",
            chatComposerPillSurfaceClass
          )}
        />
        <button
          type="submit"
          disabled={disabled || isLoading || !email}
          className={cn(
            "h-14 w-full rounded-full px-5 text-[var(--vlaina-font-sm)] font-semibold text-[var(--vlaina-color-text-strong)] transition-all duration-[var(--vlaina-duration-200)] active:scale-[var(--vlaina-scale-985)] sm:h-[var(--vlaina-size-60px)] sm:text-[var(--vlaina-font-15)] md:h-16",
            "disabled:cursor-not-allowed disabled:opacity-[var(--vlaina-opacity-50)] disabled:active:scale-[var(--vlaina-scale-100)]",
            chatComposerPillSurfaceClass
          )}
        >
          {isLoading ? t('account.sending') : t('account.continueWithEmail')}
        </button>
      </form>
    );
  }

  return (
    <form noValidate onSubmit={handleVerifyCode} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-[var(--vlaina-duration-500)]">
      <div className="space-y-2">
        <p className="text-[var(--vlaina-font-11)] font-black uppercase tracking-widest text-[var(--vlaina-sidebar-notes-text-soft)] text-center">{t('account.enterEmailCode')}</p>
        <input
          ref={codeInputRef}
          type="text"
          spellCheck={false}
          value={code}
          onChange={(e) => {
            const nextCode = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(nextCode);
          }}
          placeholder=""
          disabled={disabled || isLoading}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="[0-9]{6}"
          className={cn(
            "h-14 w-full rounded-full text-center text-[var(--vlaina-font-26)] font-black tracking-[var(--vlaina-tracking-code-sm)] text-[var(--vlaina-color-text-strong)] transition-all duration-[var(--vlaina-duration-200)] outline-none sm:h-[var(--vlaina-size-60px)] sm:text-[var(--vlaina-font-30)] sm:tracking-[var(--vlaina-tracking-code-md)] md:h-16 md:text-3xl md:tracking-[var(--vlaina-tracking-code-lg)]",
            "focus:ring-2 focus:ring-[var(--vlaina-color-accent-focus-ring)]",
            "disabled:cursor-not-allowed disabled:opacity-[var(--vlaina-opacity-50)]",
            chatComposerPillSurfaceClass
          )}
        />
      </div>
      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={disabled || isLoading || !code}
          className={cn(
            "h-14 w-full rounded-full px-5 text-[var(--vlaina-font-sm)] font-semibold text-[var(--vlaina-color-text-strong)] transition-all duration-[var(--vlaina-duration-200)] active:scale-[var(--vlaina-scale-985)] sm:h-[var(--vlaina-size-60px)] sm:text-[var(--vlaina-font-15)] md:h-16",
            "disabled:cursor-not-allowed disabled:opacity-[var(--vlaina-opacity-50)] disabled:active:scale-[var(--vlaina-scale-100)]",
            chatComposerPillSurfaceClass
          )}
        >
          {isLoading ? t('account.verifying') : t('account.verifyCode')}
        </button>
        <button
          type="button"
          onClick={() => setStep('email')}
          className="text-[var(--vlaina-font-11)] font-bold text-[var(--vlaina-sidebar-notes-text-soft)] hover:text-[var(--vlaina-color-text-strong)] transition-colors"
        >
          {t('account.changeEmailAddress')}
        </button>
      </div>
    </form>
  );
}
