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
import { SETTINGS_BEFORE_CLOSE_EVENT, SETTINGS_CLOSED_EVENT } from './settingsEvents';
import { useI18n, type MessageKey } from '@/lib/i18n';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'markdown' | 'appearance' | 'language' | 'ai' | 'about';

interface SidebarItem {
  id: SettingsTab;
  labelKey: MessageKey;
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

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('markdown');
  const [isAppearanceFontPreviewing, setIsAppearanceFontPreviewing] = useState(false);
  const { t } = useI18n();

  const handleClose = useCallback(() => {
    window.dispatchEvent(new Event(SETTINGS_BEFORE_CLOSE_EVENT));
    aiActions.deleteIncompleteCustomProviders();
    onClose();
    window.dispatchEvent(new Event(SETTINGS_CLOSED_EVENT));
  }, [onClose]);

  useEffect(() => {
    const handleOpenSettings = (e: CustomEvent<{ tab?: SettingsTab }>) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab)
      }
    }
    window.addEventListener('open-settings', handleOpenSettings as EventListener)
    return () => window.removeEventListener('open-settings', handleOpenSettings as EventListener)
  }, [])

  useModalBehavior({
    open,
    onClose: handleClose,
  });

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
            duration={0.05}
            blurPx={isAppearanceFontPreviewing ? 0 : 6}
            overlayClassName={isAppearanceFontPreviewing ? 'bg-transparent' : undefined}
          />

          <div className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none p-4">
            <div
              className="vlaina-drag-region absolute top-0 left-0 right-0 h-14 z-[105] pointer-events-auto cursor-grab active:cursor-grabbing select-none"
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                beginWindowDragTracking(
                  { x: e.clientX, y: e.clientY },
                  { onReleaseWithoutDrag: handleClose }
                );
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "relative w-[1080px] h-[720px] max-w-full max-h-[90vh] rounded-[32px] flex overflow-hidden pointer-events-auto select-none transition-[background-color,box-shadow] duration-100",
                isAppearanceFontPreviewing
                  ? "bg-transparent shadow-none ring-0"
                  : "bg-[#fcfcfc] dark:bg-[#1C1C1C] shadow-2xl ring-1 ring-black/5 dark:ring-white/5",
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
              tabIndex={-1}
            >
              <button
                type="button"
                onClick={handleClose}
                aria-label={t('common.close')}
                className={cn(
                  "absolute right-5 top-5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-all hover:bg-zinc-100 hover:text-zinc-950",
                  "dark:text-zinc-500 dark:hover:bg-zinc-100 dark:hover:text-zinc-950",
                  isAppearanceFontPreviewing && "pointer-events-none opacity-0",
                )}
              >
                <Icon name="common.close" size="md" />
              </button>

              {/* Sidebar Section */}
              <div className={cn(
                "w-[260px] flex-shrink-0 bg-transparent flex flex-col border-r border-zinc-100/50 transition-opacity duration-100 dark:border-white/5",
                isAppearanceFontPreviewing && "pointer-events-none opacity-0",
              )}>
                <div className="flex min-h-0 flex-1 px-4 pb-6 pt-10">
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 overflow-y-auto vlaina-scrollbar">
                      {sidebarGroups.map((group) => (
                        <div key={group.titleKey} className="mb-8 last:mb-0">
                          <div className="space-y-[6px]">
                            {group.items.map((item) => {
                              const isActive = activeTab === item.id;
                              return (
                                <div key={item.id} className="group/chat-sidebar-row flex items-center">
                                  <button
                                    onClick={() => setActiveTab(item.id)}
                                    className={cn(
                                      "flex min-h-[44px] w-full items-center gap-3.5 px-4 py-3 text-sm transition-all duration-300 ease-out rounded-[18px]",
                                      isActive
                                        ? "bg-[var(--sidebar-row-selected-bg)] text-[var(--sidebar-row-selected-text)] font-[550] shadow-[0_2px_8px_rgba(30,150,235,0.06)]"
                                        : "text-[var(--notes-sidebar-text)] hover:bg-[var(--notes-sidebar-row-hover)] font-medium"
                                    )}
                                  >
                                    <span className="flex items-center justify-center">
                                      <Icon
                                        size="md"
                                        name={item.icon}
                                        className={cn(
                                          "transition-all duration-300",
                                          isActive
                                            ? "text-[var(--sidebar-row-selected-text)] scale-110"
                                            : "text-[var(--notes-sidebar-text)]"
                                        )}
                                      />
                                    </span>
                                    <span className="truncate tracking-tight">{t(item.labelKey)}</span>
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
                "flex-1 flex flex-col min-w-0 relative transition-[background-color,backdrop-filter] duration-100",
                isAppearanceFontPreviewing
                  ? "bg-transparent backdrop-blur-none"
                  : "bg-white/50 backdrop-blur-sm dark:bg-[#1E1E1E]/50",
              )}>
                <div className="flex-1 overflow-y-auto w-full vlaina-scrollbar">
                  <div className={cn(
                    "w-full mx-auto",
                    activeTab === 'ai' 
                      ? "h-full" 
                      : "px-16 py-14 max-w-[860px]"
                  )}>
                    <div className={cn(
                      "animate-in fade-in slide-in-from-bottom-3 duration-75 ease-out",
                      activeTab === 'ai' ? "h-full" : "space-y-10"
                    )}>
                      {activeTab === 'about' && <AboutTab />}
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
