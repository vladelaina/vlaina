import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          disabled={disabled || isLoading}
          className={cn(
            "w-full h-12 px-5 py-3 text-[14px] font-medium transition-all duration-500 outline-none sm:h-[52px] sm:px-6 sm:py-3.5 sm:text-[15px] md:h-14 md:py-4",
            "bg-zinc-50 dark:bg-black/40",
            "border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700",
            "rounded-[18px] placeholder:text-zinc-400 sm:rounded-[20px] dark:placeholder:text-zinc-600",
            "focus:bg-white dark:focus:bg-black"
          )}
        />
        <button
          type="submit"
          disabled={disabled || isLoading || !email}
          className={cn(
            "w-full h-12 rounded-[18px] font-black text-[14px] transition-all duration-500 sm:h-[52px] sm:rounded-[20px] sm:text-[15px] md:h-14",
            "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white",
            "hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.97]",
            "disabled:opacity-50 disabled:active:scale-100"
          )}
        >
          {isLoading ? 'Sending...' : 'Continue with Email'}
        </button>
      </form>
    );
  }

  return (
    <form noValidate onSubmit={handleVerifyCode} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 text-center">Enter the code sent to your inbox</p>
        <input
          ref={codeInputRef}
          type="text"
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
            "w-full h-14 text-center text-[26px] font-black tracking-[0.35em] transition-all duration-500 outline-none sm:h-[60px] sm:text-[30px] sm:tracking-[0.45em] md:h-16 md:text-3xl md:tracking-[0.5em]",
            "bg-zinc-50 dark:bg-black/40 rounded-[18px] sm:rounded-[20px]",
            "focus:bg-white dark:focus:bg-black border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700"
          )}
        />
      </div>
      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={disabled || isLoading || !code}
          className={cn(
            "w-full h-12 rounded-[18px] font-black text-[14px] transition-all duration-500 sm:h-[52px] sm:rounded-[20px] sm:text-[15px] md:h-14",
            "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-2xl shadow-black/20",
            "active:scale-[0.97] disabled:opacity-50"
          )}
        >
          {isLoading ? 'Verifying...' : 'Verify Code'}
        </button>
        <button
          type="button"
          onClick={() => setStep('email')}
          className="text-[11px] font-bold text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
        >
          Change email address
        </button>
      </div>
    </form>
  );
}
