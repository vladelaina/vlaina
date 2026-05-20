import { Icon } from '@/components/ui/icons';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiSlice';

export function AppViewModeSwitch() {
  const { t } = useI18n();
  const appViewMode = useUIStore((state) => state.appViewMode);
  const setAppViewMode = useUIStore((state) => state.setAppViewMode);

  if (appViewMode !== 'notes' && appViewMode !== 'chat') return null;

  const options = [
    {
      key: 'notes' as const,
      label: t('app.viewNotes'),
      icon: <Icon name="file.text" size={18} />,
    },
    {
      key: 'chat' as const,
      label: t('app.viewChat'),
      icon: <Icon name="common.shootingStar" size={18} />,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label={t('shortcut.action.toggleAppViewMode')}
      className={cn(
        'relative mb-1.5 flex h-11 w-full shrink-0 items-center rounded-[22px] p-1.5',
        chatComposerPillSurfaceClass,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-1.5 left-1.5 w-[calc((100%_-_0.75rem)_/_2)] rounded-full bg-[var(--vlaina-accent-light)] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_6px_16px_-12px_rgba(30,150,235,0.85)] transition-transform duration-200 ease-out',
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
              'relative z-10 flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-[15px] font-medium leading-none transition-colors',
              selected
                ? 'text-[var(--vlaina-accent)]'
                : 'text-[var(--notes-sidebar-text)] hover:text-[var(--vlaina-accent)]',
            )}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
