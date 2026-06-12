import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { useI18n } from '@/lib/i18n';
import { APP_VIEW_MODE_SWITCH_MIN_WIDTH } from '@/lib/layout/sidebarWidth';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiSlice';
import { themeIconTokens } from '@/styles/themeTokens';

type SwitchableAppViewMode = 'notes' | 'chat';

export function AppViewModeSwitch() {
  const { t } = useI18n();
  const appViewMode = useUIStore((state) => state.appViewMode);
  const setAppViewMode = useUIStore((state) => state.setAppViewMode);
  const [optimisticAppViewMode, setOptimisticAppViewMode] = useState<typeof appViewMode | null>(null);
  const [highlightedAppViewMode, setHighlightedAppViewMode] = useState<SwitchableAppViewMode | null>(null);

  useEffect(() => {
    setOptimisticAppViewMode(null);
  }, [appViewMode]);

  const visualAppViewMode = optimisticAppViewMode ?? appViewMode;

  const handleSelectViewMode = useCallback((viewMode: SwitchableAppViewMode) => {
    setOptimisticAppViewMode(viewMode);
    setAppViewMode(viewMode);
  }, [setAppViewMode]);

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
          visualAppViewMode === 'chat' && 'translate-x-full',
        )}
      />
      {options.map((option) => {
        const selected = visualAppViewMode === option.key;
        const highlighted = selected || highlightedAppViewMode === option.key;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => handleSelectViewMode(option.key)}
            onPointerEnter={() => setHighlightedAppViewMode(option.key)}
            onPointerLeave={() => setHighlightedAppViewMode(null)}
            onFocus={() => setHighlightedAppViewMode(option.key)}
            onBlur={() => setHighlightedAppViewMode(null)}
            className={cn(
              'relative z-[var(--vlaina-z-10)] flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-[length:var(--vlaina-font-15)] font-medium leading-none',
            )}
            style={{
              color: highlighted ? 'var(--vlaina-accent)' : 'var(--vlaina-sidebar-notes-text)',
            }}
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
