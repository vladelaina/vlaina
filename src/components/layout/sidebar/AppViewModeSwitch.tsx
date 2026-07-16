import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { useI18n } from '@/lib/i18n';
import { APP_VIEW_MODE_SWITCH_MIN_WIDTH } from '@/lib/layout/sidebarWidth';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiSlice';
import { themeIconTokens, themeMotionTokens } from '@/styles/themeTokens';

type SwitchableAppViewMode = 'notes' | 'chat' | 'whiteboard' | 'graph';

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
    {
      key: 'whiteboard' as const,
      label: t('app.viewWhiteboard'),
      icon: <Icon name="editor.diagram" size={themeIconTokens.sizeCompact} />,
    },
    {
      key: 'graph' as const,
      label: t('app.viewGraph'),
      icon: <Icon name="editor.diagram" size={themeIconTokens.sizeCompact} />,
    },
  ];
  if (!options.some((option) => option.key === appViewMode)) return null;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.key === visualAppViewMode));
  const collapsedButtonsWidth = Array.from(
    { length: options.length - 1 },
    () => 'var(--vlaina-size-32px)',
  ).join(' - ');

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
        className="absolute inset-y-1.5 left-1.5 rounded-full bg-[var(--vlaina-sidebar-row-selected-bg)] shadow-[var(--vlaina-shadow-selection-soft)] transition-transform duration-[var(--vlaina-duration-300)] ease-[var(--vlaina-ease-feedback)] motion-reduce:transition-none"
        style={{
          width: `calc(100% - var(--vlaina-space-075rem) - ${collapsedButtonsWidth})`,
          transform: `translate3d(${selectedIndex * themeMotionTokens.appViewSwitchCollapsedWidth}px, 0, 0)`,
        }}
      />
      {options.map((option) => {
        const selected = visualAppViewMode === option.key;
        const highlighted = selected || highlightedAppViewMode === option.key;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-label={option.label}
            aria-selected={selected}
            onClick={() => handleSelectViewMode(option.key)}
            onPointerEnter={() => setHighlightedAppViewMode(option.key)}
            onPointerLeave={() => setHighlightedAppViewMode(null)}
            onFocus={() => setHighlightedAppViewMode(option.key)}
            onBlur={() => setHighlightedAppViewMode(null)}
            className={cn(
              'relative z-[var(--vlaina-z-10)] flex h-8 min-w-[var(--vlaina-size-32px)] basis-[var(--vlaina-size-32px)] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full text-[length:var(--vlaina-font-15)] font-medium leading-none transition-[flex-grow,gap,padding] duration-[var(--vlaina-duration-300)] ease-[var(--vlaina-ease-feedback)] motion-reduce:transition-none',
              selected
                ? 'gap-2 px-3'
                : 'gap-0 px-0',
            )}
            style={{
              flexGrow: selected ? 1 : 0,
              color: highlighted ? 'var(--vlaina-sidebar-row-selected-text)' : 'var(--vlaina-sidebar-notes-text)',
            }}
          >
            <span className="relative flex size-[var(--vlaina-size-18px)] shrink-0 items-center justify-center leading-none">
              {option.icon}
            </span>
            <span
              className={cn(
                'relative inline-flex min-w-0 items-center truncate whitespace-nowrap leading-none transition-[max-width,opacity,transform] duration-[var(--vlaina-duration-300)] ease-[var(--vlaina-ease-feedback)] motion-reduce:transition-none',
                selected
                  ? 'max-w-[var(--vlaina-size-128px)] translate-x-0 opacity-100'
                  : 'max-w-0 -translate-x-1 opacity-0',
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
