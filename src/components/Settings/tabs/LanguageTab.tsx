import { Icon } from '@/components/ui/icons';
import {
  APP_LANGUAGES,
  SYSTEM_LANGUAGE_PREFERENCE,
  type AppLanguagePreference,
  useI18n,
} from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  getSidebarIdleRowSurfaceClass,
  getSidebarSelectedRowSurfaceClass,
} from '@/components/layout/sidebar/sidebarLabelStyles';
import { SettingsSectionHeader } from '../components/SettingsControls';

export function LanguageTab() {
  const { language, languagePreference, setLanguagePreference, t } = useI18n();
  const options: Array<{
    value: AppLanguagePreference;
    label: string;
    description?: string;
  }> = [
    {
      value: SYSTEM_LANGUAGE_PREFERENCE,
      label: 'System',
      description: APP_LANGUAGES.find((option) => option.code === language)?.nativeName,
    },
    ...APP_LANGUAGES.map((option) => ({
      value: option.code,
      label: option.nativeName,
    })),
  ];

  return (
    <div className="max-w-3xl pb-10">
      <SettingsSectionHeader>{t('account.language')}</SettingsSectionHeader>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {options.map((option) => {
          const selected = languagePreference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setLanguagePreference(option.value)}
              className={cn(
                'group flex min-h-[42px] cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors',
                selected
                  ? getSidebarSelectedRowSurfaceClass('chat')
                  : getSidebarIdleRowSurfaceClass('chat'),
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className={cn('truncate font-medium', selected && 'font-[550]')}>
                  {option.label}
                </span>
                {option.description ? (
                  <span className="truncate text-[11px] text-[var(--vlaina-text-tertiary)]">
                    {option.description}
                  </span>
                ) : null}
              </span>
              {selected ? (
                <Icon
                  size="sm"
                  name="common.check"
                  className="shrink-0 text-[var(--sidebar-row-selected-text)]"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
