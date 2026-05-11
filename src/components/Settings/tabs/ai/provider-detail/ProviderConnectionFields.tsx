import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/icons';
import { SettingsTextInput } from '@/components/Settings/components/SettingsFields';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

const API_KEY_PREFIX_VISIBLE_CHARS = 7;
const API_KEY_SUFFIX_VISIBLE_CHARS = 4;

export function maskApiKey(apiKey: string): string {
  if (!apiKey) {
    return '';
  }

  if (apiKey.length <= API_KEY_PREFIX_VISIBLE_CHARS + API_KEY_SUFFIX_VISIBLE_CHARS) {
    return apiKey.slice(-API_KEY_SUFFIX_VISIBLE_CHARS);
  }

  return `${apiKey.slice(0, API_KEY_PREFIX_VISIBLE_CHARS)}••••••${apiKey.slice(-API_KEY_SUFFIX_VISIBLE_CHARS)}`;
}

export function ProviderConnectionFields({
  providerId,
  name,
  apiHost,
  apiKey,
  allowHiddenApiKeyEditing = false,
  showApiKey,
  apiKeyCopied,
  onNameChange,
  onApiHostChange,
  onApiKeyChange,
  onToggleApiKey,
  onCopyApiKey,
}: {
  providerId: string;
  name: string;
  apiHost: string;
  apiKey: string;
  allowHiddenApiKeyEditing?: boolean;
  showApiKey: boolean;
  apiKeyCopied: boolean;
  onNameChange: (value: string) => void;
  onApiHostChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onToggleApiKey: () => void;
  onCopyApiKey: () => void;
}) {
  const { t } = useI18n();
  const shouldShowRawApiKey = showApiKey || allowHiddenApiKeyEditing;
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const shouldSelectApiKeyOnRevealRef = useRef(false);

  useEffect(() => {
    if (!shouldShowRawApiKey || !shouldSelectApiKeyOnRevealRef.current) {
      return;
    }

    shouldSelectApiKeyOnRevealRef.current = false;
    const input = apiKeyInputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.select();
  }, [apiKey.length, shouldShowRawApiKey]);

  return (
    <section className={cn("overflow-hidden rounded-[26px] p-1 mb-2", chatComposerPillSurfaceClass)}>
      <div className="flex flex-col">
        {/* Channel Label */}
        <div className="flex items-center gap-4 px-7 py-5 border-b border-transparent">
          <div className="w-32 shrink-0">
            <div className="text-[14px] font-semibold text-[var(--notes-sidebar-text)]">
              {t('settings.ai.channelName')}
            </div>
          </div>
          <div className="flex-1">
            <SettingsTextInput
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t('settings.ai.newChannel')}
              className="w-full max-w-[520px]"
              inputClassName="h-10 px-5 rounded-xl text-[14px]"
              shellClassName="rounded-xl shadow-none bg-zinc-100/50 dark:bg-white/5 border-transparent"
            />
          </div>
        </div>

        {/* Base URL */}
        <div className="flex items-center gap-4 px-7 py-5 border-b border-transparent">
          <div className="w-32 shrink-0">
            <div className="text-[14px] font-semibold text-[var(--notes-sidebar-text)]">
              {t('settings.ai.baseUrl', { url: '' }).replace(/[:：]\s*$/, '')}
            </div>
          </div>
          <div className="flex-1">
            <SettingsTextInput
              type="text"
              value={apiHost}
              onChange={(e) => onApiHostChange(e.target.value)}
              placeholder="https://api.openai.com"
              name={`provider-api-host-${providerId}`}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              className="w-full max-w-[520px]"
              inputClassName="h-10 px-5 rounded-xl text-[14px]"
              shellClassName="rounded-xl shadow-none bg-zinc-100/50 dark:bg-white/5 border-transparent"
            />
          </div>
        </div>

        {/* API Key */}
        <div className="flex items-center gap-4 px-7 py-5">
          <div className="w-32 shrink-0">
            <div className="text-[14px] font-semibold text-[var(--notes-sidebar-text)]">
              {t('settings.ai.apiKey')}
            </div>
          </div>
          <div className="flex-1">
            <SettingsTextInput
              ref={apiKeyInputRef}
              type="text"
              value={shouldShowRawApiKey ? apiKey : maskApiKey(apiKey)}
              onChange={(e) => onApiKeyChange(e.target.value)}
              onFocus={() => {
                if (!shouldShowRawApiKey && apiKey) {
                  shouldSelectApiKeyOnRevealRef.current = true;
                  onToggleApiKey();
                }
              }}
              placeholder="sk-..."
              name={`provider-api-key-${providerId}`}
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              className="w-full max-w-[520px]"
              inputClassName="h-10 px-5 rounded-xl text-[14px] font-mono"
              shellClassName="rounded-xl shadow-none bg-zinc-100/50 dark:bg-white/5 border-transparent"
              trailing={
                <div className="flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    onClick={onToggleApiKey}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--notes-sidebar-text-soft)] transition-colors hover:bg-zinc-200/50 hover:text-[var(--notes-sidebar-text)] dark:hover:bg-white/10"
                    title={showApiKey ? t('settings.ai.hideApiKey') : t('settings.ai.showApiKey')}
                  >
                    <Icon name={showApiKey ? 'common.eyeOff' : 'common.eye'} size="sm" />
                  </button>
                  <button
                    type="button"
                    onClick={onCopyApiKey}
                    disabled={!apiKey}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--notes-sidebar-text-soft)] transition-colors hover:bg-zinc-200/50 hover:text-[var(--notes-sidebar-text)] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10"
                    title={apiKeyCopied ? t('common.copied') : t('common.copy')}
                  >
                    <Icon name={apiKeyCopied ? 'common.check' : 'common.copy'} size="sm" />
                  </button>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}
