import { useCallback, useState, useEffect } from 'react';
import { Icon, IconName } from '@/components/ui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { BlurBackdrop } from '@/components/common/BlurBackdrop';
import { useModalBehavior } from './hooks/useModalBehavior';
import { AboutTab } from './tabs/AboutTab';
import { MarkdownTab } from './tabs/MarkdownTab';
import { AppearanceTab } from './tabs/AppearanceTab';
import { AITab } from './tabs/AITab';
import { LanguageTab } from './tabs/LanguageTab';
import { cn } from '@/lib/utils';
import { useWindowDragGesture } from '@/hooks/useWindowDragGesture';
import { actions as aiActions } from '@/stores/ai/providerActions';
import { DialogCloseIconButton } from '@/components/common/DialogCloseIconButton';
import {
  OPEN_SETTINGS_EVENT,
  SETTINGS_BEFORE_CLOSE_EVENT,
  SETTINGS_CLOSED_EVENT,
  resolveSettingsOpenTab,
  type OpenSettingsDetail,
  type SettingsOpenTab,
  type SettingsTab,
} from './settingsEvents';
import { useI18n, type MessageKey } from '@/lib/i18n';
import type { CommunitySettings } from './tabs/aboutCommunitySettings';
import { themeBackdropTokens, themeMotionTokens } from '@/styles/themeTokens';
import { handleScrollableWheel } from '@/lib/scroll/wheelScroll';
import { DesktopUpdateBadge, useDesktopUpdateIndicatorVersion } from '@/components/desktop/DesktopUpdateIndicator';
import { useNativeTitleBarOverlayHidden } from '@/hooks/useNativeTitleBarOverlayHidden';

interface SettingsModalProps {
  open: boolean;
  communitySettings: CommunitySettings;
  requestedTab?: SettingsOpenTab;
  onClose: () => void;
}

interface SidebarItem {
  id: SettingsTab;
  labelKey?: MessageKey;
  label?: string;
  icon: IconName;
}

interface SidebarGroup {
  titleKey: MessageKey;
  items: SidebarItem[];
}

const sidebarGroups: SidebarGroup[] = [
  {
    titleKey: 'settings.general',
    items: [
      { id: 'markdown', labelKey: 'settings.tabs.markdown', icon: 'editor.code' },
      { id: 'ai', labelKey: 'settings.tabs.ai', icon: 'common.shootingStar' },
      { id: 'appearance', labelKey: 'settings.tabs.appearance', icon: 'theme.palette' },
      { id: 'language', labelKey: 'settings.tabs.language', icon: 'common.language' },
      { id: 'about', labelKey: 'settings.tabs.about', icon: 'common.info' },
    ]
  }
];

export function SettingsModal({ open, communitySettings, requestedTab, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('markdown');
  const [isAppearanceFontPreviewing, setIsAppearanceFontPreviewing] = useState(false);
  const updateIndicatorVersion = useDesktopUpdateIndicatorVersion();
  const { t } = useI18n();

  const handleClose = useCallback(() => {
    window.dispatchEvent(new Event(SETTINGS_BEFORE_CLOSE_EVENT));
    aiActions.deleteIncompleteCustomProviders();
    onClose();
    window.dispatchEvent(new Event(SETTINGS_CLOSED_EVENT));
  }, [onClose]);

  useEffect(() => {
    const handleOpenSettings = (e: CustomEvent<OpenSettingsDetail>) => {
      const nextTab = resolveSettingsOpenTab(e.detail?.tab);
      if (nextTab) {
        setActiveTab(nextTab);
      }
    }
    window.addEventListener(OPEN_SETTINGS_EVENT, handleOpenSettings as EventListener)
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handleOpenSettings as EventListener)
  }, [])

  useEffect(() => {
    if (!open) return;
    const nextTab = resolveSettingsOpenTab(requestedTab);
    if (nextTab) {
      setActiveTab(nextTab);
    }
  }, [open, requestedTab])

  useModalBehavior({
    open,
    onClose: handleClose,
  });
  useNativeTitleBarOverlayHidden(open);

  const { beginWindowDragTracking, stopWindowDragTracking } = useWindowDragGesture({
    errorLabel: 'settings modal drag',
  });

  useEffect(() => {
    if (open) return;
    stopWindowDragTracking();
    setIsAppearanceFontPreviewing(false);
  }, [open, stopWindowDragTracking]);

  useEffect(() => {
    if (activeTab === 'appearance') return;
    setIsAppearanceFontPreviewing(false);
  }, [activeTab]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <BlurBackdrop
            onClick={handleClose}
            duration={themeBackdropTokens.settingsModalDurationSeconds}
            blurPx={isAppearanceFontPreviewing ? 0 : themeBackdropTokens.settingsModalBlurPx}
            overlayClassName={isAppearanceFontPreviewing ? 'bg-transparent' : undefined}
          />

          <div className="fixed inset-0 flex items-center justify-center z-[var(--vlaina-z-100)] pointer-events-none p-4 max-[640px]:p-2">
            <div
              className="app-drag-region absolute top-0 left-0 right-0 h-14 z-[var(--vlaina-z-105)] pointer-events-auto cursor-grab active:cursor-grabbing select-none"
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                beginWindowDragTracking(
                  { x: e.clientX, y: e.clientY },
                  { onReleaseWithoutDrag: handleClose }
                );
              }}
            />

            <motion.div
              initial={{
                opacity: themeMotionTokens.opacityHidden,
                scale: themeMotionTokens.settingsModalInitialScale,
                y: themeMotionTokens.settingsModalY,
              }}
              animate={{
                opacity: themeMotionTokens.opacityVisible,
                scale: themeMotionTokens.settingsModalVisibleScale,
                y: themeMotionTokens.settingsModalVisibleY,
              }}
              exit={{
                opacity: themeMotionTokens.opacityHidden,
                scale: themeMotionTokens.settingsModalInitialScale,
                y: themeMotionTokens.settingsModalY,
              }}
              transition={{
                duration: themeMotionTokens.settingsModalDuration,
                ease: themeMotionTokens.settingsModalEase,
              }}
              className={cn(
                "relative flex h-[var(--vlaina-size-720px)] max-h-[calc(100vh_-_var(--vlaina-size-32px))] w-[var(--vlaina-size-1080px)] max-w-full min-w-0 overflow-hidden rounded-[var(--vlaina-radius-32px)] pointer-events-auto select-none transition-[background-color,box-shadow] duration-[var(--vlaina-duration-100)] max-[900px]:flex-col max-[640px]:max-h-[calc(100vh_-_var(--vlaina-size-16px))] max-[640px]:rounded-[var(--vlaina-radius-24px)]",
                isAppearanceFontPreviewing
                  ? "bg-transparent shadow-[var(--vlaina-shadow-none)] ring-0"
                  : "bg-[var(--vlaina-color-setting-panel)] shadow-[var(--vlaina-shadow-2xl)] ring-1 ring-[var(--vlaina-color-subtle-border)]",
              )}
              onMouseDownCapture={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                }
              }}
              onAuxClickCapture={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              data-settings-modal="true"
              data-settings-active-tab={activeTab}
              tabIndex={-1}
            >
              <DialogCloseIconButton
                onClick={handleClose}
                label={t('common.close')}
                data-settings-action="close"
                className={cn(
                  "absolute right-5 top-5 z-[var(--vlaina-z-10)]",
                  isAppearanceFontPreviewing && "pointer-events-none opacity-[var(--vlaina-opacity-0)]",
                )}
              />

              {/* Sidebar Section */}
              <div className={cn(
                "flex w-[var(--vlaina-size-260px)] flex-shrink-0 flex-col border-r border-[var(--vlaina-color-border-shell)] bg-[var(--vlaina-sidebar-notes-surface)] transition-opacity duration-[var(--vlaina-duration-100)] max-[900px]:w-full max-[900px]:border-r-0 max-[900px]:border-b max-[900px]:flex-none",
                isAppearanceFontPreviewing && "pointer-events-none opacity-[var(--vlaina-opacity-0)]",
              )}>
                <div className="flex min-h-0 flex-1 px-4 pb-6 pt-10 max-[900px]:px-3 max-[900px]:pb-3 max-[900px]:pt-12">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <div
                      className="flex-1 overflow-y-auto app-scrollbar max-[900px]:overflow-x-auto max-[900px]:overflow-y-hidden max-[900px]:scrollbar-hidden"
                      data-settings-scroll-root="sidebar"
                      onWheel={handleScrollableWheel}
                    >
                      {sidebarGroups.map((group) => (
                        <div key={group.titleKey} className="mb-8 last:mb-0 max-[900px]:mb-0">
                          <div className="space-y-[var(--vlaina-space-y-6px)] max-[900px]:flex max-[900px]:gap-2 max-[900px]:space-y-0">
                            {group.items.map((item) => {
                              const isActive = activeTab === item.id;
                              const label = item.label ?? (item.labelKey ? t(item.labelKey) : '');
                              const showUpdateIndicator = item.id === 'about' && Boolean(updateIndicatorVersion);
                              const updateIndicatorLabel = showUpdateIndicator
                                ? t('settings.updateIndicator')
                                : '';
                              return (
                                <div key={item.id} className="group/chat-sidebar-row flex items-center max-[900px]:shrink-0">
                                  <button
                                    type="button"
                                    aria-label={showUpdateIndicator ? `${label} ${updateIndicatorLabel}` : undefined}
                                    data-settings-tab={item.id}
                                    data-active={isActive ? 'true' : undefined}
                                    onClick={() => setActiveTab(item.id)}
                                    className={cn(
                                      "group/settings-sidebar-tab flex min-h-[var(--vlaina-size-44px)] w-full items-center gap-3.5 rounded-[var(--vlaina-radius-18px)] px-4 py-3 text-sm leading-none transition-all duration-[var(--vlaina-duration-300)] ease-out max-[900px]:w-auto max-[900px]:gap-2.5 max-[900px]:whitespace-nowrap max-[900px]:px-3.5",
                                      isActive
                                        ? "bg-[var(--vlaina-sidebar-row-selected-bg)] text-[var(--vlaina-sidebar-row-selected-text)] font-[var(--vlaina-font-weight-semibold-plus)] shadow-[var(--vlaina-shadow-selection-soft)]"
                                        : "text-[var(--vlaina-sidebar-notes-text)] hover:bg-transparent hover:text-[var(--vlaina-sidebar-row-selected-text)] hover:shadow-[var(--vlaina-shadow-none)] font-medium"
                                    )}
                                  >
                                    <span className="flex size-5 shrink-0 items-center justify-center leading-none">
                                      <Icon
                                        size="md"
                                        name={item.icon}
                                        className={cn(
                                          "transition-all duration-[var(--vlaina-duration-300)]",
                                          isActive
                                            ? "text-[var(--vlaina-sidebar-row-selected-text)] scale-[var(--vlaina-scale-110)]"
                                            : "text-[var(--vlaina-sidebar-notes-text)] group-hover/settings-sidebar-tab:text-[var(--vlaina-sidebar-row-selected-text)]"
                                        )}
                                      />
                                    </span>
                                    <span className="inline-flex min-w-0 items-center truncate leading-none tracking-tight">
                                      {label}
                                    </span>
                                    {showUpdateIndicator ? (
                                      <DesktopUpdateBadge
                                        version={updateIndicatorVersion}
                                        className="ml-auto max-w-[7.5rem] max-[900px]:ml-0"
                                      />
                                    ) : null}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content Section */}
              <div className={cn(
                "relative flex min-h-0 min-w-0 flex-1 flex-col transition-[background-color,backdrop-filter] duration-[var(--vlaina-duration-100)]",
                isAppearanceFontPreviewing
                  ? "bg-transparent backdrop-blur-[var(--vlaina-backdrop-blur-none)]"
                  : "bg-[var(--vlaina-color-setting-content)] backdrop-blur-[var(--vlaina-backdrop-blur-sm)]",
              )}>
                <div
                  className="flex-1 overflow-y-auto w-full app-scrollbar"
                  data-settings-scroll-root="content"
                  onWheel={handleScrollableWheel}
                >
                  <div className={cn(
                    "w-full mx-auto",
                    activeTab === 'ai' 
                      ? "h-full" 
                      : "max-w-[var(--vlaina-size-860px)] px-16 py-14 max-[900px]:px-6 max-[900px]:py-6 max-[640px]:px-4 max-[640px]:py-5"
                  )}>
                    <div className={cn(
                      "animate-in fade-in slide-in-from-bottom-3 duration-[var(--vlaina-duration-75)] ease-out",
                      activeTab === 'ai' ? "h-full min-h-0" : "space-y-10"
                    )}>
                      {activeTab === 'about' && <AboutTab community={communitySettings} />}
                      {activeTab === 'markdown' && <MarkdownTab />}
                      {activeTab === 'appearance' && (
                        <AppearanceTab onFontSizePreviewingChange={setIsAppearanceFontPreviewing} />
                      )}
                      {activeTab === 'language' && <LanguageTab />}
                      {activeTab === 'ai' && <AITab />}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
