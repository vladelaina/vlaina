import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/icons';
import { SettingsTextInput } from '@/components/Settings/components/SettingsFields';
import { SettingsItem } from '@/components/Settings/components/SettingsControls';

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
    <section className="space-y-1">
      <SettingsItem
        title="Channel Label"
        description="A friendly name for this connection."
      >
        <SettingsTextInput
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="New Channel"
          className="w-64"
          inputClassName="h-9 px-4 rounded-xl text-[13px]"
          shellClassName="rounded-xl shadow-none"
        />
      </SettingsItem>

      <SettingsItem
        title="Base URL"
        description="The API endpoint for the provider."
      >
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
          className="w-64"
          inputClassName="h-9 px-4 rounded-xl text-[13px]"
          shellClassName="rounded-xl shadow-none"
        />
      </SettingsItem>

      <SettingsItem
        title="API Key"
        description="Your secret key for authentication."
      >
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
          className="w-64"
          inputClassName="h-9 px-4 rounded-xl text-[13px] font-mono"
          shellClassName="rounded-xl shadow-none"
          trailing={
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onToggleApiKey}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--notes-sidebar-text-soft)] transition-colors hover:bg-zinc-100 hover:text-[var(--notes-sidebar-text)] dark:hover:bg-white/10"
                title={showApiKey ? 'Hide API Key' : 'Show API Key'}
              >
                <Icon name={showApiKey ? 'common.eyeOff' : 'common.eye'} size="sm" />
              </button>
              <button
                type="button"
                onClick={onCopyApiKey}
                disabled={!apiKey}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--notes-sidebar-text-soft)] transition-colors hover:bg-zinc-100 hover:text-[var(--notes-sidebar-text)] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10"
                title={apiKeyCopied ? 'Copied' : 'Copy API Key'}
              >
                <Icon name={apiKeyCopied ? 'common.check' : 'common.copy'} size="sm" />
              </button>
            </div>
          }
        />
      </SettingsItem>
    </section>
  );
}
