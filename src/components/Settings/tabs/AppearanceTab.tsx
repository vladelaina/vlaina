import type { ChangeEvent, MouseEvent, PointerEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import {
  UI_FONT_SIZE_DEFAULT,
  UI_FONT_SIZE_MAX,
  UI_FONT_SIZE_MIN,
  useUIStore,
} from '@/stores/uiSlice';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

interface AppearanceTabProps {
  onFontSizePreviewingChange?: (previewing: boolean) => void;
}

export function AppearanceTab({ onFontSizePreviewingChange }: AppearanceTabProps = {}) {
  const { t } = useI18n();
  const fontSize = useUIStore((state) => state.fontSize);
  const setFontSize = useUIStore((state) => state.setFontSize);
  const resetFontSize = useUIStore((state) => state.resetFontSize);
  const [isPreviewingFontSize, setIsPreviewingFontSize] = useState(false);
  const [draftFontSize, setDraftFontSize] = useState(fontSize);
  const draftFontSizeRef = useRef(fontSize);
  const previewingFontSizeRef = useRef(false);

  const displayedFontSize = isPreviewingFontSize ? draftFontSize : fontSize;

  useEffect(() => {
    if (isPreviewingFontSize) return;
    setDraftFontSize(fontSize);
  }, [fontSize, isPreviewingFontSize]);

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
        setFontSize(draftFontSizeRef.current);
      }
      onFontSizePreviewingChange?.(false);
    };
  }, [isPreviewingFontSize, onFontSizePreviewingChange, setFontSize]);

  const progressPercent = useMemo(() => {
    const bounded = Math.max(UI_FONT_SIZE_MIN, Math.min(UI_FONT_SIZE_MAX, displayedFontSize));
    return ((bounded - UI_FONT_SIZE_MIN) / (UI_FONT_SIZE_MAX - UI_FONT_SIZE_MIN)) * 100;
  }, [displayedFontSize]);

  const handleFontSizeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = parseInt(e.target.value);
    if (draftFontSizeRef.current === next) return;
    draftFontSizeRef.current = next;
    setDraftFontSize(next);
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--vlaina-markdown-font-size', `${next}px`);
    }
  };

  const beginFontSizePreview = (event: PointerEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>) => {
    if ('button' in event && event.button !== 0) return;
    draftFontSizeRef.current = fontSize;
    setDraftFontSize(fontSize);
    previewingFontSizeRef.current = true;
    setIsPreviewingFontSize(true);
  };

  const handleResetFontSize = () => {
    draftFontSizeRef.current = UI_FONT_SIZE_DEFAULT;
    setDraftFontSize(UI_FONT_SIZE_DEFAULT);
    resetFontSize();
  };

  const fontSizeSlider = (
    <input
      type="range"
      spellCheck={false}
      min={UI_FONT_SIZE_MIN}
      max={UI_FONT_SIZE_MAX}
      step="1"
      value={displayedFontSize}
      onChange={handleFontSizeChange}
      onPointerDown={beginFontSizePreview}
      onMouseDown={beginFontSizePreview}
      className="h-1.5 w-44 rounded-lg appearance-none cursor-pointer accent-[var(--sidebar-row-selected-text)]"
      style={{
        background: `linear-gradient(to right, var(--sidebar-row-selected-text) 0%, var(--sidebar-row-selected-text) ${progressPercent}%, rgb(228 228 231) ${progressPercent}%, rgb(228 228 231) 100%)`,
      }}
    />
  );

  return (
    <div
      className="max-w-3xl pb-10"
    >
      <div className={cn(
        "mb-4 flex items-center justify-between px-2",
        isPreviewingFontSize && "pointer-events-none opacity-0",
      )}>
        <span className="text-[13px] font-medium text-[var(--notes-sidebar-text-soft)]">
          {t('settings.appearance.fontSize')}
        </span>
      </div>

      <div
        className={cn(
          "mb-3 flex items-center justify-between rounded-[22px] px-6 py-4",
          isPreviewingFontSize
            ? "border border-transparent !bg-transparent !shadow-none hover:!shadow-none"
            : chatComposerPillSurfaceClass,
        )}
      >
        <div className={cn(
          "flex-1 pr-8",
          isPreviewingFontSize && "pointer-events-none opacity-0",
        )}>
          <div className="text-[14px] font-semibold text-[var(--notes-sidebar-text)] mb-0.5">
            {t('settings.appearance.baseFontSize')}
          </div>
        </div>
        <div className={cn(
          "flex flex-shrink-0 items-center gap-4",
          isPreviewingFontSize && "w-[20rem]",
        )}>
          <Icon
            size="md"
            name="editor.type"
            className={cn(
              "text-[var(--notes-sidebar-text-soft)]",
              isPreviewingFontSize && "pointer-events-none opacity-0",
            )}
          />
          {fontSizeSlider}
          <span className={cn(
            "w-10 text-sm font-medium text-right tabular-nums text-[var(--notes-sidebar-text)]",
            isPreviewingFontSize && "pointer-events-none opacity-0",
          )}>
            {displayedFontSize}px
          </span>
          <button
            type="button"
            onClick={handleResetFontSize}
            disabled={fontSize === UI_FONT_SIZE_DEFAULT}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--sidebar-row-selected-text)] transition-colors hover:bg-[var(--sidebar-row-selected-bg)] disabled:pointer-events-none disabled:text-[var(--notes-sidebar-text-soft)] disabled:opacity-45 dark:hover:bg-[rgba(65,168,234,0.14)]",
              isPreviewingFontSize && "hidden",
            )}
          >
            {t('common.reset')}
          </button>
        </div>
      </div>
    </div>
  );
}
