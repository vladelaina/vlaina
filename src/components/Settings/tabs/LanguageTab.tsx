import { useMemo } from 'react';
import { Icon } from '@/components/ui/icons';
import {
  APP_LANGUAGES,
  SYSTEM_LANGUAGE_PREFERENCE,
  type AppLanguagePreference,
  useI18n,
  getBrowserLanguages,
  resolveSystemLanguage,
} from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  getSidebarLabelClass,
} from '@/components/layout/sidebar/sidebarLabelStyles';
import { SettingsSectionHeader } from '../components/SettingsControls';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

const ACTUAL_SYSTEM_LANG_CODE = resolveSystemLanguage(getBrowserLanguages());
const ACTUAL_SYSTEM_LANG_NATIVE_NAME = APP_LANGUAGES.find(
  (option) => option.code === ACTUAL_SYSTEM_LANG_CODE
)?.nativeName;

export function LanguageTab() {
  const { languagePreference, setLanguagePreference, t } = useI18n();

  const options: Array<{
    value: AppLanguagePreference;
    label: string;
    description?: string;
  }> = [
    {
      value: SYSTEM_LANGUAGE_PREFERENCE,
      label: 'System',
      description: ACTUAL_SYSTEM_LANG_NATIVE_NAME,
    },
    ...APP_LANGUAGES.map((option) => ({
      value: option.code,
      label: option.nativeName,
    })),
  ];

  return (
    <div className="max-w-3xl pb-10">
      <SettingsSectionHeader>{t('account.language')}</SettingsSectionHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = languagePreference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setLanguagePreference(option.value)}
              className={cn(
                'group flex min-h-[56px] cursor-pointer items-center justify-between gap-4 rounded-[22px] px-6 py-3 text-left transition-all duration-200 border border-transparent',
                selected
                  ? 'bg-[var(--sidebar-row-selected-bg)] dark:bg-[rgba(65,168,234,0.12)]'
                  : chatComposerPillSurfaceClass,
              )}
            >
              <div className="flex min-w-0 flex-col">
                <span className={cn('truncate text-[14px]', getSidebarLabelClass('notes', { selected }))}>
                  {option.label}
                </span>
                {option.description ? (
                  <span className={cn(
                    'truncate text-[11px]',
                    selected ? 'text-[var(--sidebar-row-selected-text)]/70' : 'text-[var(--notes-sidebar-text-soft)]'
                  )}>
                    {option.description}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
