import { Icon } from '@/components/ui/icons';
import { SettingsTextInput } from '@/components/Settings/components/SettingsFields';

export function ProviderConnectionFields({
  providerId,
  name,
  apiHost,
  apiKey,
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
  showApiKey: boolean;
  apiKeyCopied: boolean;
  onNameChange: (value: string) => void;
  onApiHostChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onToggleApiKey: () => void;
  onCopyApiKey: () => void;
}) {
  return (
    <section className="p-1">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-gray-500">Channel Label</label>
          <SettingsTextInput
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="New Channel"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-gray-500">Base URL</label>
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
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-gray-500">API Key</label>
          <SettingsTextInput
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="sk-..."
            name={`provider-api-key-${providerId}`}
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            inputClassName="font-mono"
            trailing={
              <>
                <button
                  type="button"
                  onClick={onToggleApiKey}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                  title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                >
                  <Icon name={showApiKey ? 'common.eyeOff' : 'common.eye'} size="sm" />
                </button>
                <button
                  type="button"
                  onClick={onCopyApiKey}
                  disabled={!apiKey}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-gray-200"
                  title={apiKeyCopied ? 'Copied' : 'Copy API Key'}
                >
                  <Icon name={apiKeyCopied ? 'common.check' : 'common.copy'} size="sm" />
                </button>
              </>
            }
          />
        </div>
      </div>
    </section>
  );
}
