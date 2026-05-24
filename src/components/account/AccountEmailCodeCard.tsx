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
          type="email"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('account.emailAddress')}
          disabled={disabled || isLoading}
          className={cn(
            "h-14 w-full rounded-full px-5 py-3 text-center text-[14px] font-medium text-zinc-950 transition-all duration-200 outline-none sm:h-[60px] sm:px-6 sm:py-3.5 sm:text-[15px] md:h-16",
            "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
            "focus:ring-2 focus:ring-[var(--vlaina-accent)]/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            chatComposerPillSurfaceClass
          )}
        />
        <button
          type="submit"
          disabled={disabled || isLoading || !email}
          className={cn(
            "h-14 w-full rounded-full px-5 text-[14px] font-semibold text-zinc-950 transition-all duration-200 active:scale-[0.985] sm:h-[60px] sm:text-[15px] md:h-16",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
            chatComposerPillSurfaceClass
          )}
        >
          {isLoading ? t('account.sending') : t('account.continueWithEmail')}
        </button>
      </form>
    );
  }

  return (
    <form noValidate onSubmit={handleVerifyCode} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 text-center">{t('account.enterEmailCode')}</p>
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
            "h-14 w-full rounded-full text-center text-[26px] font-black tracking-[0.35em] text-zinc-950 transition-all duration-200 outline-none sm:h-[60px] sm:text-[30px] sm:tracking-[0.45em] md:h-16 md:text-3xl md:tracking-[0.5em]",
            "focus:ring-2 focus:ring-[var(--vlaina-accent)]/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            chatComposerPillSurfaceClass
          )}
        />
      </div>
      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={disabled || isLoading || !code}
          className={cn(
            "h-14 w-full rounded-full px-5 text-[14px] font-semibold text-zinc-950 transition-all duration-200 active:scale-[0.985] sm:h-[60px] sm:text-[15px] md:h-16",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
            chatComposerPillSurfaceClass
          )}
        >
          {isLoading ? t('account.verifying') : t('account.verifyCode')}
        </button>
        <button
          type="button"
          onClick={() => setStep('email')}
          className="text-[11px] font-bold text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
        >
          {t('account.changeEmailAddress')}
        </button>
      </div>
    </form>
  );
}
