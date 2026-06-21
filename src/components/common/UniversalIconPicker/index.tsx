import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { isInsideMenuLayer } from '@/components/layout/sidebar/context-menu/shared';
import { EmojiTab } from './EmojiTab';
import { UploadTab, type CustomIcon } from './UploadTab';
import {
  TabType,
  ACTIVE_TAB_KEY,
  RECENT_ICONS_KEY,
  SKIN_TONE_KEY,
  loadActiveTab,
  saveActiveTab,
  loadRecentIcons,
  addToRecentIcons,
  MAX_RECENT_EMOJIS,
  loadSkinTone,
  EMOJI_CATEGORIES,
} from './constants';
import { useI18n } from '@/lib/i18n';
import { hasIconImageScheme, hasIconSymbolScheme, isIconImageValue } from './iconImageValue';
import {
  describeIconPickerDebugTarget,
  getIconPickerDebugLogText,
  isIconPickerDebugEnabled,
  logIconPickerDebug,
} from './debugLog';

export interface UniversalIconPickerProps {
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  onRemove?: () => void;
  onClose: () => void;
  hasIcon?: boolean;
  currentIcon?: string;
  currentSize?: number;
  minSize?: number;
  maxSize?: number;
  onSizeChange?: (size: number) => void;
  onSizeConfirm?: (size: number) => void;
  customIcons?: CustomIcon[];
  onUploadFile?: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  onDeleteCustomIcon?: (id: string) => void | Promise<void>;
  onSkinToneChange?: (tone: number) => void;
  onPreviewSkinTone?: (tone: number | null) => void;
  embedded?: boolean;
  imageLoader?: (src: string) => Promise<string>;
  emojiOnly?: boolean;
  emojiSearchQuery?: string;
  alwaysShowEmojiCategories?: boolean;
  surface?: boolean;
  allowLegacyImageScheme?: boolean;
}

export function UniversalIconPicker({
  onSelect,
  onPreview,
  onRemove,
  onClose,
  hasIcon = false,
  currentIcon,
  currentSize,
  minSize = 20,
  maxSize = 150,
  onSizeChange,
  onSizeConfirm,
  
  customIcons = [],
  onUploadFile,
  onDeleteCustomIcon,
  
  onSkinToneChange,
  onPreviewSkinTone,

  embedded = false,
  imageLoader,
  emojiOnly = false,
  emojiSearchQuery,
  alwaysShowEmojiCategories = false,
  surface = !embedded,
  allowLegacyImageScheme = false,
}: UniversalIconPickerProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onPreviewRef = useRef(onPreview);
  const [activeTab, setActiveTab] = useState<TabType>(() => emojiOnly ? 'emoji' : loadActiveTab());
  const [recentIcons, setRecentIcons] = useState<string[]>(loadRecentIcons);
  const [skinTone, setSkinTone] = useState(loadSkinTone);
  const [debugCopied, setDebugCopied] = useState(false);

  const [activeEmojiCategory, setActiveEmojiCategory] = useState<string>('people');
  const lastRandomIconRef = useRef<string | null>(null);

  const visibleRecentIcons = useMemo(() =>
    recentIcons
      .filter((icon) => allowLegacyImageScheme || !hasIconImageScheme(icon))
      .filter((icon) => (
        !emojiOnly ||
        (!hasIconSymbolScheme(icon) && !isIconImageValue(icon) && !hasIconImageScheme(icon))
      ))
      .slice(0, MAX_RECENT_EMOJIS),
    [allowLegacyImageScheme, emojiOnly, recentIcons]
  );

  const handleTabChange = useCallback((tab: TabType) => {
    if (emojiOnly && tab !== 'emoji') return;
    setActiveTab(tab);
    if (!emojiOnly) {
      saveActiveTab(tab);
    }
  }, [emojiOnly]);

  const recentIconsRef = useRef(recentIcons);
  recentIconsRef.current = recentIcons;
  onCloseRef.current = onClose;
  onPreviewRef.current = onPreview;

  const handleEmojiSelect = useCallback((emoji: string) => {
    lastRandomIconRef.current = null;
    const updated = addToRecentIcons(emoji, recentIconsRef.current);
    setRecentIcons(updated);
    logIconPickerDebug('select-emoji', { emoji });
    onSelect(emoji);
    onCloseRef.current();
  }, [onSelect]);
  
  const handleSkinToneChangeInternal = useCallback((tone: number) => {
    setSkinTone(tone);
    onSkinToneChange?.(tone);
  }, [onSkinToneChange]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_TAB_KEY) {
        if (emojiOnly) return;
        setActiveTab(loadActiveTab());
        return;
      }

      if (event.key === RECENT_ICONS_KEY) {
        setRecentIcons(loadRecentIcons());
        return;
      }

      if (event.key === SKIN_TONE_KEY) {
        const nextTone = loadSkinTone();
        setSkinTone(nextTone);
        onSkinToneChange?.(nextTone);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [emojiOnly, onSkinToneChange]);

  const handleUploadSelect = useCallback((assetUrl: string) => {
    lastRandomIconRef.current = null;
    const updated = addToRecentIcons(assetUrl, recentIconsRef.current);
    setRecentIcons(updated);
    logIconPickerDebug('select-upload', { assetUrl });
    onSelect(assetUrl);
    onCloseRef.current();
  }, [onSelect]);

  const removeTriggeredRef = useRef(false);

  const handleRemove = useCallback(() => {
    if (removeTriggeredRef.current) return;
    removeTriggeredRef.current = true;
    lastRandomIconRef.current = null;
    onPreviewRef.current?.(null);
    onPreviewSkinTone?.(null);
    logIconPickerDebug('remove');
    onRemove?.();
    onCloseRef.current();
  }, [onPreviewSkinTone, onRemove]);

  const handleClose = useCallback((reason = 'close') => {
    logIconPickerDebug('close', {
      reason,
      lastRandomIcon: lastRandomIconRef.current,
    });
    if (lastRandomIconRef.current) {
      const updated = addToRecentIcons(lastRandomIconRef.current, recentIconsRef.current);
      setRecentIcons(updated);
      lastRandomIconRef.current = null;
    }
    onCloseRef.current();
  }, []);

  const handleRemoveEvent = useCallback((event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handleRemove();
  }, [handleRemove]);

  const handleRandom = useCallback(() => {
    if (activeTab === 'emoji') {
      const currentCategory = EMOJI_CATEGORIES.find(c => c.id === activeEmojiCategory);
      const emojis = currentCategory?.emojis || [];
      if (emojis.length > 0) {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        lastRandomIconRef.current = randomEmoji.native;
        logIconPickerDebug('random-emoji', {
          icon: randomEmoji.native,
          category: activeEmojiCategory,
        });
        onSelect(randomEmoji.native);
      }
    } else if (activeTab === 'upload') {
      if (customIcons.length > 0) {
        const randomEmoji = customIcons[Math.floor(Math.random() * customIcons.length)];
        lastRandomIconRef.current = randomEmoji.url;
        logIconPickerDebug('random-upload', { icon: randomEmoji.url });
        onSelect(randomEmoji.url);
      }
    }
  }, [activeTab, activeEmojiCategory, onSelect, customIcons]);

  const handleCopyDebugLog = useCallback(async () => {
    const text = getIconPickerDebugLogText();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        try {
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
        } finally {
          textArea.remove();
        }
      }
      setDebugCopied(true);
      window.setTimeout(() => setDebugCopied(false), 1200);
    } catch (error) {
      logIconPickerDebug('copy-debug-log-failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  useEffect(() => {
    if (embedded) return;

    const onPointerDownCapture = (e: PointerEvent) => {
      const target = e.target;
      const targetElement = target instanceof Element ? target : null;
      const insidePicker = Boolean(containerRef.current && target instanceof Node && containerRef.current.contains(target));
      const preventClose = Boolean(targetElement?.closest('[data-prevent-picker-close]'));
      const insideMenuLayer = isInsideMenuLayer(target);
      logIconPickerDebug('document-pointerdown-capture', {
        target: describeIconPickerDebugTarget(target),
        insidePicker,
        preventClose,
        insideMenuLayer,
      });

      if (preventClose) return;
      if (insideMenuLayer) return;
      if (!insidePicker) {
        onPreviewRef.current?.(null);
        handleClose('outside-pointerdown');
      }
    };
    document.addEventListener('pointerdown', onPointerDownCapture, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDownCapture, true);
    };
  }, [handleClose, embedded]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onPreviewRef.current?.(null);
        handleClose('escape');
      }
      if (e.key === 'Tab' && e.ctrlKey) {
        if (emojiOnly) return;
        e.preventDefault();
        e.stopPropagation();
        const tabs: TabType[] = ['emoji', 'upload'];
        const currentIndex = tabs.indexOf(activeTab);
        const nextIndex = (currentIndex + 1) % tabs.length;
        handleTabChange(tabs[nextIndex]);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [emojiOnly, handleClose, activeTab, handleTabChange]);

  return (
    <div
      ref={containerRef}
      data-no-editor-drag-box="true"
      className={cn(
        "flex flex-col gap-1 w-[var(--vlaina-size-352px)] select-none",
        !embedded && "absolute z-[var(--vlaina-z-50)]",
      )}
    >
      {isIconPickerDebugEnabled() && !embedded && (
        <button
          type="button"
          aria-label="Copy icon picker logs"
          title="Copy icon picker logs"
          data-prevent-picker-close="true"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleCopyDebugLog();
          }}
          className={cn(
            "fixed bottom-20 right-4 z-[var(--vlaina-z-max)] flex h-9 w-9 items-center justify-center rounded-[var(--vlaina-radius-10px)]",
            "text-[var(--vlaina-text-secondary)] transition-colors",
            chatComposerPillSurfaceClass,
            iconButtonStyles
          )}
        >
          <Icon name={debugCopied ? "common.check" : "common.copy"} size="md" />
        </button>
      )}

      {onSizeChange && currentSize !== undefined && (
        <div className="flex items-center px-4 py-1">
          <PremiumSlider
            min={minSize}
            max={maxSize}
            value={currentSize}
            onChange={(newVal: number) => {
              onSizeChange(newVal);
            }}
            onConfirm={onSizeConfirm}
          />
        </div>
      )}

      <div className={cn(
        "flex flex-col overflow-hidden",
        surface && cn("!rounded-[var(--vlaina-radius-26px)] backdrop-blur-[var(--vlaina-backdrop-blur-lg)]", chatComposerPillSurfaceClass)
      )}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--vlaina-border)] overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTabChange('emoji');
              }}
              className={cn(
                "text-sm font-medium pb-1 border-b-2 transition-all active:scale-[var(--vlaina-scale-95)] whitespace-nowrap",
                activeTab === 'emoji'
                  ? "text-[var(--vlaina-text-primary)] border-[var(--vlaina-accent)]"
                  : "text-[var(--vlaina-text-tertiary)] border-transparent hover:text-[var(--vlaina-text-primary)]"
              )}
            >
              {t('icon.emoji')}
            </button>
            {!emojiOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTabChange('upload');
                }}
                className={cn(
                  "text-sm font-medium pb-1 border-b-2 transition-all active:scale-[var(--vlaina-scale-95)] whitespace-nowrap",
                  activeTab === 'upload'
                    ? "text-[var(--vlaina-text-primary)] border-[var(--vlaina-accent)]"
                    : "text-[var(--vlaina-text-tertiary)] border-transparent hover:text-[var(--vlaina-text-primary)]"
                )}
              >
                {t('common.upload')}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRandom();
              }}
              className={cn("p-1 -ml-1 flex items-center justify-center transition-all active:scale-[var(--vlaina-scale-90)]", iconButtonStyles)}
            >
              <Icon name="misc.shuffle" size="md" />
            </button>
          </div>
          {hasIcon && onRemove && (
            <button
              type="button"
              onPointerDown={handleRemoveEvent}
              onMouseDown={handleRemoveEvent}
              onClick={handleRemoveEvent}
              className="text-xs font-medium transition-all active:scale-[var(--vlaina-scale-95)] text-[var(--vlaina-text-tertiary)] hover:text-[var(--vlaina-color-status-danger-fg)]"
            >
              {t('common.remove')}
            </button>
          )}
        </div>

        {activeTab === 'emoji' ? (
          <EmojiTab
            skinTone={skinTone}
            setSkinTone={handleSkinToneChangeInternal}
            recentIcons={visibleRecentIcons}
            onSelect={handleEmojiSelect}
            onPreview={onPreview}
            currentIcon={currentIcon}
            activeCategory={activeEmojiCategory}
            onCategoryChange={setActiveEmojiCategory}
            onSkinToneChange={handleSkinToneChangeInternal}
            onPreviewSkinTone={onPreviewSkinTone}
            searchQuery={emojiSearchQuery}
            alwaysShowCategories={alwaysShowEmojiCategories}
            imageLoader={imageLoader}
            allowLegacyImageScheme={allowLegacyImageScheme}
          />
        ) : (
          <UploadTab
            onSelect={handleUploadSelect}
            onPreview={onPreview}
            onClose={onClose}
            customIcons={customIcons}
            onUploadFile={onUploadFile}
            onDeleteCustomIcon={onDeleteCustomIcon}
            imageLoader={imageLoader}
            allowLegacyImageScheme={allowLegacyImageScheme}
          />
        )}
      </div>
    </div>
  );
}
