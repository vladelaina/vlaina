import type { ChangeEvent, CSSProperties, MouseEvent, PointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import type { IconName } from '@/components/ui/icons';
import {
  UI_FONT_SIZE_DEFAULT,
  UI_FONT_SIZE_MAX,
  UI_FONT_SIZE_MIN,
  useUIStore,
} from '@/stores/uiSlice';
import { useToastStore } from '@/stores/useToastStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { openPathInFileManager } from '@/lib/desktop/shell';
import { useI18n } from '@/lib/i18n';
import {
  ensureImportedMarkdownThemesDirectory,
  listImportedMarkdownThemesFromDirectory,
  syncImportedMarkdownThemesFromDirectory,
} from '@/lib/markdown/theme-compatibility/importedThemeStorage';
import type { ImportedMarkdownThemeMetadata } from '@/lib/markdown/theme-compatibility/types';
import {
  preloadCompiledImportedMarkdownThemeStyles,
  preloadMarkdownThemeCompiler,
} from '@/components/markdown-theme/markdownThemeCompiler';
import { applyMarkdownFontSize } from '@/lib/markdown/markdownFontSize';
import { cn } from '@/lib/utils';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { themeUiFeedbackTokens } from '@/styles/themeTokens';
import { selectMarkdownImportedThemeId } from '@/stores/unified/settings/markdownSettings';
import { dialogCloseIconButtonClassName } from '@/components/common/DialogCloseIconButton';
import { SettingsItem, SettingsSectionHeader } from '../components/SettingsControls';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ColorMode = 'system' | 'light' | 'dark';

const COLOR_MODE_OPTIONS = [
  {
    value: 'system',
    iconName: 'theme.system' as IconName,
  },
  {
    value: 'light',
    iconName: 'theme.light' as IconName,
  },
  {
    value: 'dark',
    iconName: 'theme.dark' as IconName,
  },
] as const;

function buildFontSizeSliderBackground(progressPercent: string): string {
  return [
    'linear-gradient(to right,',
    'var(--vlaina-sidebar-row-selected-text) 0%,',
    `var(--vlaina-sidebar-row-selected-text) ${progressPercent},`,
    `var(--vlaina-bg-tertiary) ${progressPercent},`,
    'var(--vlaina-bg-tertiary) 100%)',
  ].join(' ');
}

interface ColorModeToggleProps {
  colorMode: ColorMode;
  onChange: (mode: ColorMode) => void;
}

function ColorModeToggle({ colorMode, onChange }: ColorModeToggleProps) {
  const { t } = useI18n();
  const colorModeIndex = Math.max(0, COLOR_MODE_OPTIONS.findIndex((option) => option.value === colorMode));

  return (
    <div className="relative flex h-8 w-[var(--vlaina-size-126px)] shrink-0 items-center">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-[var(--vlaina-accent-light)] shadow-[var(--vlaina-shadow-selection-soft)] transition-transform duration-[var(--vlaina-duration-200)] ease-out"
        style={{ transform: `translateX(${colorModeIndex * 100}%)` }}
      />
      {COLOR_MODE_OPTIONS.map((option) => {
        const isActive = colorMode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-label={t(`settings.appearance.${option.value}Mode`)}
            aria-pressed={isActive}
            data-settings-color-mode={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-[var(--vlaina-z-10)] flex h-8 flex-1 items-center justify-center rounded-full transition-colors",
              isActive
                ? "text-[var(--vlaina-accent)]"
                : "text-[var(--vlaina-sidebar-notes-text)] hover:text-[var(--vlaina-accent)]"
            )}
          >
            <Icon name={option.iconName} size="sm" />
          </button>
        );
      })}
    </div>
  );
}

interface ThemeDropdownProps {
  importedThemeId: string | null;
  importedThemes: ImportedMarkdownThemeMetadata[];
  onChange: (themeId: string | null) => void;
  onRefresh: () => void;
  onWarmup: () => void;
  onThemePreload: (themeId: string) => void;
}

function ThemeDropdown({
  importedThemeId,
  importedThemes,
  onChange,
  onRefresh,
  onWarmup,
  onThemePreload,
}: ThemeDropdownProps) {
  const { t } = useI18n();
  const activeTheme = importedThemeId
    ? importedThemes.find((theme) => theme.id === importedThemeId) ?? null
    : null;
  const activeThemeName = activeTheme?.name ?? t('settings.appearance.theme.default');

  return (
    <DropdownMenu onOpenChange={(open) => {
      if (open) {
        onWarmup();
        onRefresh();
      }
    }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-[var(--vlaina-size-132px)] max-w-full min-w-0 items-center justify-between gap-3 rounded-full px-2.5 text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-sidebar-notes-text)] transition-colors hover:bg-[var(--vlaina-accent-light)] hover:text-[var(--vlaina-accent)]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{activeThemeName}</span>
          </span>
          <Icon name="nav.chevronDown" size="sm" className="text-[var(--vlaina-sidebar-notes-text-soft)]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[var(--vlaina-z-120)] min-w-[var(--vlaina-size-170px)] rounded-2xl border-[var(--vlaina-border)] bg-[var(--vlaina-color-setting-field)] p-1.5 shadow-[var(--vlaina-shadow-floating-panel)]"
      >
        <DropdownMenuItem
          onSelect={() => onChange(null)}
          className={cn(
            "rounded-xl px-3 py-2 text-[var(--vlaina-font-13)] text-[var(--vlaina-sidebar-chat-text)] focus:bg-[var(--vlaina-sidebar-row-selected-bg)] focus:text-[var(--vlaina-sidebar-row-selected-text)]",
            importedThemeId === null && "text-[var(--vlaina-sidebar-row-selected-text)]"
          )}
        >
          <span className="truncate">{t('settings.appearance.theme.default')}</span>
        </DropdownMenuItem>
        {importedThemes.map((theme) => (
          <DropdownMenuItem
            key={theme.id}
            onFocus={() => onThemePreload(theme.id)}
            onPointerEnter={() => onThemePreload(theme.id)}
            onSelect={() => onChange(theme.id)}
            className={cn(
              "rounded-xl px-3 py-2 text-[var(--vlaina-font-13)] text-[var(--vlaina-sidebar-chat-text)] focus:bg-[var(--vlaina-sidebar-row-selected-bg)] focus:text-[var(--vlaina-sidebar-row-selected-text)]",
              importedThemeId === theme.id && "text-[var(--vlaina-sidebar-row-selected-text)]"
            )}
          >
            <span className="min-w-0 flex-1 truncate">{theme.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ThemeAppearanceControlProps {
  colorMode: ColorMode;
  importedThemeId: string | null;
  importedThemes: ImportedMarkdownThemeMetadata[];
  onColorModeChange: (mode: ColorMode) => void;
  onThemeChange: (themeId: string | null) => void;
  onThemeRefresh: () => void;
  onThemeWarmup: () => void;
  onThemePreload: (themeId: string) => void;
}

function ThemeAppearanceControl({
  colorMode,
  importedThemeId,
  importedThemes,
  onColorModeChange,
  onThemeChange,
  onThemeRefresh,
  onThemeWarmup,
  onThemePreload,
}: ThemeAppearanceControlProps) {
  return (
    <div className={cn(
      "flex h-11 min-w-0 max-w-full items-center rounded-[var(--vlaina-radius-22px)] p-1.5 max-[520px]:h-auto max-[520px]:w-full max-[520px]:flex-wrap max-[520px]:gap-1.5",
      chatComposerPillSurfaceClass,
    )}>
      <ColorModeToggle colorMode={colorMode} onChange={onColorModeChange} />
      <div className="mx-2 h-5 w-px bg-[var(--vlaina-divider)] max-[520px]:hidden" />
      <div className="min-w-0 flex-1 max-[520px]:w-full max-[520px]:flex-none">
        <ThemeDropdown
          importedThemeId={importedThemeId}
          importedThemes={importedThemes}
          onChange={onThemeChange}
          onRefresh={onThemeRefresh}
          onWarmup={onThemeWarmup}
          onThemePreload={onThemePreload}
        />
      </div>
    </div>
  );
}

interface AppearanceTabProps {
  onFontSizePreviewingChange?: (previewing: boolean) => void;
}

const FONT_SIZE_PREVIEW_DEBOUNCE_MS = 120;

export function AppearanceTab({ onFontSizePreviewingChange }: AppearanceTabProps = {}) {
  const { t } = useI18n();
  const fontSize = useUIStore((state) => state.fontSize);
  const setFontSize = useUIStore((state) => state.setFontSize);
  const resetFontSize = useUIStore((state) => state.resetFontSize);
  const colorMode = useUnifiedStore((state) => {
    const mode = state.data.settings.ui?.colorMode;
    return mode === 'light' || mode === 'dark' ? mode : 'system';
  });
  const importedThemeId = useUnifiedStore(selectMarkdownImportedThemeId);
  const setColorMode = useUnifiedStore((state) => state.setColorMode);
  const setMarkdownImportedThemeId = useUnifiedStore((state) => state.setMarkdownImportedThemeId);
  const addToast = useToastStore((state) => state.addToast);
  const [isPreviewingFontSize, setIsPreviewingFontSize] = useState(false);
  const [draftFontSize, setDraftFontSize] = useState(fontSize);
  const [importedThemes, setImportedThemes] = useState<ImportedMarkdownThemeMetadata[]>([]);
  const draftFontSizeRef = useRef(fontSize);
  const previewingFontSizeRef = useRef(false);
  const pendingFontSizeFrameRef = useRef<number | null>(null);
  const pendingFontSizeTimerRef = useRef<number | null>(null);
  const pendingFontSizeRef = useRef(fontSize);

  const displayedFontSize = isPreviewingFontSize ? draftFontSize : fontSize;

  useEffect(() => {
    if (isPreviewingFontSize) return;
    setDraftFontSize(fontSize);
  }, [fontSize, isPreviewingFontSize]);

  const cancelScheduledMarkdownFontSizePreview = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (pendingFontSizeFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingFontSizeFrameRef.current);
      pendingFontSizeFrameRef.current = null;
    }
    if (pendingFontSizeTimerRef.current !== null) {
      window.clearTimeout(pendingFontSizeTimerRef.current);
      pendingFontSizeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelScheduledMarkdownFontSizePreview();
    };
  }, [cancelScheduledMarkdownFontSizePreview]);

  useEffect(() => {
    onFontSizePreviewingChange?.(isPreviewingFontSize);
    previewingFontSizeRef.current = isPreviewingFontSize;
  }, [isPreviewingFontSize, onFontSizePreviewingChange]);

  useEffect(() => {
    draftFontSizeRef.current = draftFontSize;
  }, [draftFontSize]);

  useEffect(() => {
    if (!isPreviewingFontSize) return;

    const commitPreview = () => {
      if (!previewingFontSizeRef.current) return;
      previewingFontSizeRef.current = false;
      cancelScheduledMarkdownFontSizePreview();
      applyMarkdownFontSize(draftFontSizeRef.current);
      setIsPreviewingFontSize(false);
      setFontSize(draftFontSizeRef.current);
    };

    window.addEventListener('pointerup', commitPreview, true);
    window.addEventListener('pointercancel', commitPreview, true);
    window.addEventListener('mouseup', commitPreview, true);
    window.addEventListener('blur', commitPreview);
    return () => {
      window.removeEventListener('pointerup', commitPreview, true);
      window.removeEventListener('pointercancel', commitPreview, true);
      window.removeEventListener('mouseup', commitPreview, true);
      window.removeEventListener('blur', commitPreview);
      if (previewingFontSizeRef.current) {
        previewingFontSizeRef.current = false;
        cancelScheduledMarkdownFontSizePreview();
        applyMarkdownFontSize(draftFontSizeRef.current);
        setFontSize(draftFontSizeRef.current);
      }
      onFontSizePreviewingChange?.(false);
    };
  }, [cancelScheduledMarkdownFontSizePreview, isPreviewingFontSize, onFontSizePreviewingChange, setFontSize]);

  const progressPercent = useMemo(() => {
    const bounded = Math.max(UI_FONT_SIZE_MIN, Math.min(UI_FONT_SIZE_MAX, displayedFontSize));
    return `${((bounded - UI_FONT_SIZE_MIN) / (UI_FONT_SIZE_MAX - UI_FONT_SIZE_MIN)) * 100}%`;
  }, [displayedFontSize]);

  const scheduleMarkdownFontSizePreview = useCallback((next: number) => {
    pendingFontSizeRef.current = next;
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      applyMarkdownFontSize(next);
      return;
    }

    if (previewingFontSizeRef.current) {
      if (pendingFontSizeTimerRef.current !== null) {
        window.clearTimeout(pendingFontSizeTimerRef.current);
      }
      pendingFontSizeTimerRef.current = window.setTimeout(() => {
        pendingFontSizeTimerRef.current = null;
        if (pendingFontSizeFrameRef.current !== null) {
          return;
        }
        pendingFontSizeFrameRef.current = window.requestAnimationFrame(() => {
          pendingFontSizeFrameRef.current = null;
          applyMarkdownFontSize(pendingFontSizeRef.current);
        });
      }, FONT_SIZE_PREVIEW_DEBOUNCE_MS);
      return;
    }

    if (pendingFontSizeFrameRef.current !== null) return;
    pendingFontSizeFrameRef.current = window.requestAnimationFrame(() => {
      pendingFontSizeFrameRef.current = null;
      applyMarkdownFontSize(pendingFontSizeRef.current);
    });
  }, []);

  const handleFontSizeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = parseInt(e.target.value);
    if (draftFontSizeRef.current === next) return;
    draftFontSizeRef.current = next;
    setDraftFontSize(next);
    scheduleMarkdownFontSizePreview(next);
  };

  const beginFontSizePreview = (event: PointerEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>) => {
    if ('button' in event && event.button !== 0) return;
    if (previewingFontSizeRef.current) return;
    draftFontSizeRef.current = fontSize;
    setDraftFontSize(fontSize);
    previewingFontSizeRef.current = true;
    setIsPreviewingFontSize(true);
  };

  const handleResetFontSize = () => {
    cancelScheduledMarkdownFontSizePreview();
    draftFontSizeRef.current = UI_FONT_SIZE_DEFAULT;
    setDraftFontSize(UI_FONT_SIZE_DEFAULT);
    applyMarkdownFontSize(UI_FONT_SIZE_DEFAULT);
    resetFontSize();
  };

  const refreshImportedThemes = useCallback(async () => {
    try {
      const result = await syncImportedMarkdownThemesFromDirectory();
      setImportedThemes(result.themes);
    } catch {
      try {
        setImportedThemes(await listImportedMarkdownThemesFromDirectory());
      } catch {
        setImportedThemes([]);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void listImportedMarkdownThemesFromDirectory()
      .then((themes) => {
        if (!cancelled) {
          setImportedThemes(themes);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImportedThemes([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenThemeDirectory = useCallback(async () => {
    try {
      const directoryPath = await ensureImportedMarkdownThemesDirectory();
      await openPathInFileManager(directoryPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.appearance.openThemeFolderFailed');
      addToast(message, 'error', themeUiFeedbackTokens.errorToastDurationMs);
    }
  }, [addToast, t]);

  const handleThemeWarmup = useCallback(() => {
    preloadMarkdownThemeCompiler();
  }, []);

  const handleThemePreload = useCallback((themeId: string) => {
    preloadCompiledImportedMarkdownThemeStyles(themeId);
  }, []);

  const fontSizeSlider = (
    <input
      type="range"
      spellCheck={false}
      data-settings-control="appearance-font-size"
      min={UI_FONT_SIZE_MIN}
      max={UI_FONT_SIZE_MAX}
      step="1"
      value={displayedFontSize}
      onChange={handleFontSizeChange}
      onPointerDown={beginFontSizePreview}
      onMouseDown={beginFontSizePreview}
      className="appearance-font-size-slider h-1.5 w-full min-w-0 cursor-pointer appearance-none rounded-lg accent-[var(--vlaina-sidebar-row-selected-text)]"
      style={{
        '--vlaina-appearance-font-size-progress': progressPercent,
        '--vlaina-gradient-appearance-font-size-slider': buildFontSizeSliderBackground(progressPercent),
        background: 'var(--vlaina-gradient-appearance-font-size-slider)',
      } as CSSProperties}
    />
  );

  return (
    <div
      className="max-w-3xl pb-10"
      data-settings-tab-panel="appearance"
    >
      <div className={cn(
        "mb-4 flex items-center justify-between px-2",
        isPreviewingFontSize && "pointer-events-none opacity-[var(--vlaina-opacity-0)]",
      )}>
        <span className="text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-sidebar-notes-text-soft)]">
          {t('settings.appearance.fontSize')}
        </span>
      </div>

      <div
        className={cn(
          "mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-[var(--vlaina-radius-22px)] px-6 py-4 max-[640px]:px-4",
          isPreviewingFontSize
            ? "border border-transparent !bg-transparent !shadow-[var(--vlaina-shadow-none)] hover:!shadow-[var(--vlaina-shadow-none)]"
            : chatComposerPillSurfaceClass,
        )}
      >
        <div className={cn(
          "min-w-max flex-[1_1_auto] pr-4 max-[420px]:w-full max-[420px]:pr-0",
          isPreviewingFontSize && "pointer-events-none opacity-[var(--vlaina-opacity-0)]",
        )}>
          <div className="mb-0.5 whitespace-nowrap text-[var(--vlaina-font-sm)] font-semibold text-[var(--vlaina-sidebar-notes-text)]">
            {t('settings.appearance.baseFontSize')}
          </div>
        </div>
        <div className={cn(
          "ml-auto flex min-w-0 flex-shrink-0 items-center gap-4 max-[420px]:ml-0 max-[420px]:w-full max-[420px]:flex-wrap",
        )}>
          <div className="min-w-[var(--vlaina-size-180px)] flex-1 max-[420px]:min-w-0">
            {fontSizeSlider}
          </div>
          <span className={cn(
            "w-10 text-sm font-medium text-right tabular-nums text-[var(--vlaina-sidebar-notes-text)]",
            isPreviewingFontSize && "pointer-events-none",
          )}>
            {displayedFontSize}px
          </span>
          <button
            type="button"
            data-settings-action="reset-font-size"
            onClick={handleResetFontSize}
            disabled={fontSize === UI_FONT_SIZE_DEFAULT}
            className={cn(
              "rounded-full px-3 py-1.5 text-[var(--vlaina-font-xs)] font-medium text-[var(--vlaina-sidebar-row-selected-text)] transition-colors hover:bg-[var(--vlaina-sidebar-row-selected-bg)] disabled:pointer-events-none disabled:text-[var(--vlaina-sidebar-notes-text-soft)] disabled:opacity-[var(--vlaina-opacity-45)]",
              isPreviewingFontSize && "pointer-events-none opacity-[var(--vlaina-opacity-0)]",
            )}
          >
            {t('common.reset')}
          </button>
        </div>
      </div>

      <SettingsSectionHeader className={cn(isPreviewingFontSize && "pointer-events-none opacity-[var(--vlaina-opacity-0)]")}>
        {t('settings.appearance.display')}
      </SettingsSectionHeader>
      <SettingsItem
        data-settings-item="appearance-theme"
        title={t('settings.appearance.theme')}
        className={cn(
          "flex-wrap gap-y-3",
          isPreviewingFontSize && "pointer-events-none opacity-[var(--vlaina-opacity-0)]"
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 max-[420px]:w-full max-[420px]:justify-start">
          <ThemeAppearanceControl
            colorMode={colorMode}
            importedThemeId={importedThemeId}
            importedThemes={importedThemes}
            onColorModeChange={setColorMode}
            onThemeChange={setMarkdownImportedThemeId}
            onThemeRefresh={() => void refreshImportedThemes()}
            onThemeWarmup={handleThemeWarmup}
            onThemePreload={handleThemePreload}
          />
          <button
            type="button"
            aria-label={t('settings.appearance.openThemeFolder')}
            data-settings-action="open-theme-folder"
            onClick={() => void handleOpenThemeDirectory()}
            className={dialogCloseIconButtonClassName}
          >
            <Icon name="file.folderOpenArrow" size="md" />
          </button>
        </div>
      </SettingsItem>
    </div>
  );
}
