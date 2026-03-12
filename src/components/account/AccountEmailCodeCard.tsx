import { useState, type FormEvent } from 'react';
import { cn } from '@/lib/utils';

interface AccountEmailCodeCardProps {
  isCompact: boolean;
  disabled: boolean;
  onEmailCodeRequest: (email: string) => Promise<boolean>;
  onEmailCodeVerify: (email: string, code: string) => Promise<boolean>;
}

type FeedbackState =
  | { type: 'success'; message: string }
  | { type: 'error'; message: string }
  | null;

export function AccountEmailCodeCard({
  isCompact,
  disabled,
  onEmailCodeRequest,
  onEmailCodeVerify,
}: AccountEmailCodeCardProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const handleEmailCodeRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail) {
      setFeedback({ type: 'error', message: 'Enter an email address first.' });
      return;
    }

    setIsSubmittingEmail(true);
    setFeedback(null);
    try {
      const ok = await onEmailCodeRequest(nextEmail);
      if (ok) {
        setPendingEmail(nextEmail);
        setCode('');
        setFeedback({
          type: 'success',
          message: `Verification code sent to ${nextEmail}. Enter the 6-digit code below.`,
        });
      } else {
        setFeedback({ type: 'error', message: 'Failed to send verification code.' });
      }
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleEmailCodeVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextEmail = (pendingEmail || email).trim();
    const nextCode = code.trim();
    if (!nextEmail) {
      setFeedback({ type: 'error', message: 'Enter an email address first.' });
      return;
    }
    if (!/^\d{6}$/.test(nextCode)) {
      setFeedback({ type: 'error', message: 'Enter the 6-digit verification code.' });
      return;
    }

    setIsSubmittingEmail(true);
    setFeedback(null);
    try {
      const ok = await onEmailCodeVerify(nextEmail, nextCode);
      if (!ok) {
        setFeedback({ type: 'error', message: 'Verification failed. Check the code and try again.' });
        return;
      }
      setPendingEmail('');
      setCode('');
      setFeedback(null);
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const emailDisabled = disabled || isSubmittingEmail;

  return (
    <>
      <div
        className={cn(
          'rounded-xl border p-3 space-y-3',
          isCompact
            ? 'border-[var(--neko-border)] bg-[var(--neko-bg-secondary)]'
            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-[#202020]'
        )}
      >
        <div className={cn('font-semibold', isCompact ? 'text-[13px]' : 'text-sm text-gray-900 dark:text-gray-100')}>
          Sign in with Email Code
        </div>
        <div
          className={cn(
            isCompact ? 'mt-0.5 text-[11px] text-[var(--neko-text-tertiary)]' : 'text-xs text-gray-500'
          )}
        >
          We send a 6-digit verification code. No password required.
        </div>

        <form onSubmit={handleEmailCodeRequest} className="space-y-3">
          <div className={cn('flex gap-2', isCompact ? 'flex-col' : 'flex-col sm:flex-row')}>
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (pendingEmail && pendingEmail !== event.target.value.trim()) {
                  setPendingEmail('');
                  setCode('');
                }
              }}
              placeholder="name@example.com"
              disabled={emailDisabled}
              className={cn(
                'min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
                isCompact
                  ? 'border-[var(--neko-border)] bg-[var(--neko-bg-primary)] text-[var(--neko-text-primary)]'
                  : 'border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-[#161616] dark:text-gray-100'
              )}
            />
            <button
              type="submit"
              disabled={emailDisabled}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                isCompact
                  ? 'bg-[var(--neko-text-primary)] text-[var(--neko-bg-primary)]'
                  : 'bg-black text-white dark:bg-white dark:text-black'
              )}
            >
              {isSubmittingEmail ? 'Sending...' : pendingEmail ? 'Resend Code' : 'Send Code'}
            </button>
          </div>
        </form>

        {pendingEmail ? (
          <form onSubmit={handleEmailCodeVerify} className="space-y-3">
            <div className={cn('flex gap-2', isCompact ? 'flex-col' : 'flex-col sm:flex-row')}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                disabled={emailDisabled}
                className={cn(
                  'min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm tracking-[0.3em] outline-none transition-colors',
                  isCompact
                    ? 'border-[var(--neko-border)] bg-[var(--neko-bg-primary)] text-[var(--neko-text-primary)]'
                    : 'border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-[#161616] dark:text-gray-100'
                )}
              />
              <button
                type="submit"
                disabled={emailDisabled}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  isCompact
                    ? 'bg-[var(--neko-text-primary)] text-[var(--neko-bg-primary)]'
                    : 'bg-black text-white dark:bg-white dark:text-black'
                )}
              >
                {isSubmittingEmail ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      {feedback ? (
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-xs',
            feedback.type === 'success'
              ? isCompact
                ? 'bg-emerald-500/10 text-emerald-600'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
              : isCompact
                ? 'bg-red-500/10 text-red-500'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
          )}
        >
          {feedback.message}
        </div>
      ) : null}
    </>
  );
}
