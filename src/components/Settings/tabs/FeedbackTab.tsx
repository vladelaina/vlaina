import { useState } from 'react';
import { Send } from 'lucide-react';
import { getElectronBridge } from '@/lib/electron/bridge';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { SettingsSectionHeader } from '../components/SettingsControls';

const API_BASE = 'https://api.vlaina.com';
const MAX_FEEDBACK_LENGTH = 2000;

async function submitWebFeedback(message: string) {
  const response = await fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  const payload = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
}

async function submitFeedback(message: string) {
  const bridge = getElectronBridge();
  if (bridge?.account?.submitFeedback) {
    const payload = await bridge.account.submitFeedback(message);
    if (payload?.success === false) {
      throw new Error(payload.error || 'Failed to submit feedback');
    }
    return;
  }

  await submitWebFeedback(message);
}

function normalizeFeedbackError(error: unknown, t: ReturnType<typeof useI18n>['t']): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/missing session token|invalid session token|unauthorized|http 401|http 403/i.test(message)) {
    return t('settings.feedback.error.signInRequired');
  }
  if (/too large|invalid feedback message/i.test(message)) {
    return t('settings.feedback.error.generic');
  }
  if (/failed to fetch|network|load failed/i.test(message)) {
    return t('settings.feedback.error.network');
  }
  return message || t('settings.feedback.error.generic');
}

export function FeedbackTab({ compact = false }: { compact?: boolean }) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const { t } = useI18n();

  const trimmedMessage = message.trim();
  const canSubmit = trimmedMessage.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await submitFeedback(trimmedMessage);
      setMessage('');
      addToast(t('settings.feedback.success'), 'success');
    } catch (error) {
      addToast(normalizeFeedbackError(error, t), 'error', 4500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <SettingsSectionHeader>{t('settings.feedback.title')}</SettingsSectionHeader>
        <div className="rounded-[24px] border border-[var(--vlaina-color-panel-border)] bg-[var(--vlaina-color-panel-glass)] p-5 shadow-[var(--vlaina-shadow-panel-soft)]">
          <div className="space-y-4">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, MAX_FEEDBACK_LENGTH + 200))}
              placeholder={t('settings.feedback.placeholder')}
              className={cn(
                compact ? 'min-h-[150px]' : 'min-h-[220px]',
                'w-full resize-y rounded-[18px] border border-[var(--vlaina-border)] bg-[var(--vlaina-color-input-surface)] px-4 py-3 text-[14px] leading-6 text-[var(--notes-sidebar-text)] outline-none transition-colors placeholder:text-[var(--notes-sidebar-text-soft)] focus:border-[var(--vlaina-accent)]'
              )}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--vlaina-accent)] px-4 text-[13px] font-semibold text-[var(--vlaina-color-white)] transition-colors hover:bg-[var(--vlaina-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={15} />
                {submitting ? t('settings.feedback.submitting') : t('settings.feedback.submit')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
