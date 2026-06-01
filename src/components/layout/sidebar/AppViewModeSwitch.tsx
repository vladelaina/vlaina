import { Icon } from '@/components/ui/icons';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { useI18n } from '@/lib/i18n';
import { APP_VIEW_MODE_SWITCH_MIN_WIDTH } from '@/lib/layout/sidebarWidth';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiSlice';
import { themeIconTokens } from '@/styles/themeTokens';

export function AppViewModeSwitch() {
  const { t } = useI18n();
  const appViewMode = useUIStore((state) => state.appViewMode);
  const setAppViewMode = useUIStore((state) => state.setAppViewMode);

  if (appViewMode !== 'notes' && appViewMode !== 'chat') return null;

  const options = [
    {
      key: 'notes' as const,
      label: t('app.viewNotes'),
      icon: <Icon name="file.text" size={themeIconTokens.sizeCompact} />,
    },
    {
      key: 'chat' as const,
      label: t('app.viewChat'),
      icon: <Icon name="common.shootingStar" size={themeIconTokens.sizeCompact} />,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label={t('shortcut.action.toggleAppViewMode')}
      className={cn(
        'relative mb-1.5 flex h-11 w-full shrink-0 items-center rounded-[var(--vlaina-radius-22px)] p-1.5',
        chatComposerPillSurfaceClass,
      )}
      style={{ minWidth: APP_VIEW_MODE_SWITCH_MIN_WIDTH }}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-1.5 left-1.5 w-[var(--vlaina-width-view-mode-thumb)] rounded-full bg-[var(--vlaina-accent-light)] shadow-[var(--vlaina-shadow-selection-soft)] transition-transform duration-[var(--vlaina-duration-200)] ease-out',
          appViewMode === 'chat' && 'translate-x-full',
        )}
      />
      {options.map((option) => {
        const selected = appViewMode === option.key;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => setAppViewMode(option.key)}
            className={cn(
              'relative z-[var(--vlaina-z-10)] flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-[var(--vlaina-font-15)] font-medium leading-none transition-colors',
              selected
                ? 'text-[var(--vlaina-accent)]'
                : 'text-[var(--vlaina-sidebar-notes-text)] hover:text-[var(--vlaina-accent)]',
            )}
          >
            <span className="flex size-[var(--vlaina-size-18px)] shrink-0 items-center justify-center leading-none">
              {option.icon}
            </span>
            <span className="inline-flex min-w-0 items-center truncate leading-none">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
