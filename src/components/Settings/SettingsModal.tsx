import { useCallback, useState, useEffect } from 'react';
import { Icon, IconName } from '@/components/ui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { BlurBackdrop } from '@/components/common/BlurBackdrop';
import { useModalBehavior } from './hooks/useModalBehavior';
import { AboutTab } from './tabs/AboutTab';
import { MarkdownTab } from './tabs/MarkdownTab';
import { AppearanceTab } from './tabs/AppearanceTab';
import { AITab } from './tabs/AITab';
import { cn } from '@/lib/utils';
import { useWindowDragGesture } from '@/hooks/useWindowDragGesture';
import { actions as aiActions } from '@/stores/ai/providerActions';
import { SETTINGS_BEFORE_CLOSE_EVENT } from './settingsEvents';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'markdown' | 'appearance' | 'ai' | 'about';

interface SidebarItem {
  id: SettingsTab;
  label: string;
  icon: IconName;
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

const sidebarGroups: SidebarGroup[] = [
  {
    title: 'General',
    items: [
      { id: 'markdown', label: 'Markdown', icon: 'editor.code' },
      { id: 'ai', label: 'Spark', icon: 'common.shootingStar' },
      { id: 'appearance', label: 'Appearance', icon: 'theme.palette' },
      { id: 'about', label: 'about', icon: 'common.info' },
    ]
  }
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('markdown');

  const handleClose = useCallback(() => {
    window.dispatchEvent(new Event(SETTINGS_BEFORE_CLOSE_EVENT));
    aiActions.deleteIncompleteCustomProviders();
    onClose();
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
  }, [open, stopWindowDragTracking]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <BlurBackdrop onClick={handleClose} />

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
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-[1080px] h-[720px] max-w-full max-h-[90vh] bg-white dark:bg-[#1C1C1C] rounded-[16px] shadow-2xl flex overflow-hidden pointer-events-auto ring-1 ring-black/5 dark:ring-white/5 select-none"
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
              <div className="w-[260px] flex-shrink-0 bg-[var(--vlaina-sidebar-bg)] flex flex-col">
                <div className="flex-1 overflow-y-auto px-3 pt-6 pb-4 space-y-7">
                  {sidebarGroups.map((group) => (
                    <div key={group.title}>
                      <div className="space-y-[2px]">
                        {group.items.map((item) => {
                          const isActive = activeTab === item.id;
                          return (
                            <div key={item.id} className="group/chat-sidebar-row flex items-center py-[1px]">
                              <button
                                onClick={() => setActiveTab(item.id)}
                                className={cn(
                                  "mx-1 flex min-h-9 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 ease-out",
                                  isActive
                                    ? "bg-[var(--chat-sidebar-row-active)] text-[var(--sidebar-row-selected-text)]"
                                    : "text-[var(--chat-sidebar-text-muted)] hover:bg-[var(--chat-sidebar-row-hover)] hover:text-[var(--chat-sidebar-text)]"
                                )}
                              >
                                <span className="flex items-center justify-center">
                                  <Icon
                                    size="md"
                                    name={item.icon}
                                    className={cn(
                                      isActive
                                        ? "text-[var(--sidebar-row-selected-text)]"
                                        : "text-[var(--chat-sidebar-icon)] group-hover/chat-sidebar-row:text-[var(--chat-sidebar-icon-hover)]"
                                    )}
                                  />
                                </span>
                                <span className="truncate">{item.label}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#1E1E1E] relative">
                <div className="absolute top-3.5 right-5 z-20">
                  <button
                    onClick={handleClose}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors duration-200"
                  >
                    <Icon name="common.close" className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto w-full vlaina-scrollbar">
                  <div className={cn(
                    "w-full mx-auto",
                    activeTab === 'ai' 
                      ? "h-full" 
                      : "px-12 py-10 max-w-[800px]"
                  )}>
                    <div className={cn(
                      "animate-in fade-in slide-in-from-bottom-2 duration-500",
                      activeTab === 'ai' ? "h-full" : "space-y-8"
                    )}>
                      {activeTab === 'about' && <AboutTab />}
                      {activeTab === 'markdown' && <MarkdownTab />}
                      {activeTab === 'appearance' && <AppearanceTab />}
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
