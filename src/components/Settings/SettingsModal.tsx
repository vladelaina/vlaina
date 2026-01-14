
import { useState, useEffect, useRef } from 'react';
import { X, Palette, Keyboard, Info, Database, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { useModalBehavior } from './hooks/useModalBehavior';
import { useShortcutEditor } from './hooks/useShortcutEditor';
import { AboutTab } from './tabs/AboutTab';
import { AppearanceTab } from './tabs/AppearanceTab';
import { ShortcutsTab } from './tabs/ShortcutsTab';
import { StorageTab } from './tabs/StorageTab';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import { useLicenseStore } from '@/stores/useLicenseStore';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'shortcuts' | 'storage' | 'about';

interface SidebarItem {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

const sidebarGroups: SidebarGroup[] = [
  {
    title: 'General',
    items: [
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
      { id: 'about', label: 'About NekoTick', icon: Info },
    ]
  },
  {
    title: 'Workspace',
    items: [
      { id: 'storage', label: 'Storage', icon: Database },
    ]
  }
];

/**
 * Settings modal with tabs for About, Appearance, and Shortcuts
 * Redesigned to match modern style (1:1 Replica)
 */
export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  // Store data for profile section
  const { username, avatarUrl, isConnected } = useGithubSyncStore();
  const { isProUser } = useLicenseStore();

  // Shortcut editor state
  const {
    shortcuts,
    editingId,
    recordingKeys,
    startEditing,
    clearShortcut,
    handleKeyDown,
    resetState: resetShortcutState,
  } = useShortcutEditor();

  // Modal behavior (ESC, scroll lock)
  useModalBehavior({
    open,
    onClose,
    isEditing: editingId !== null,
    onCancelEdit: () => resetShortcutState(),
  });

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      // Default to Appearance
      // But keep user preference if we want persistence later. For now, reset.
      resetShortcutState();
    }
  }, [open, resetShortcutState]);

  // Refs for tracking drag logic
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const startDrag = async () => {
    isDraggingRef.current = true;
    console.log('startDrag executed (Movement Trigger)');
    try {
      await getCurrentWindow().startDragging();
    } catch (e) {
      console.error('Failed to start dragging', e);
    }
  };

  const getTabTitle = (tab: SettingsTab) => {
    switch (tab) {
      case 'appearance': return 'Appearance settings';
      case 'shortcuts': return 'Keyboard shortcuts';
      case 'storage': return 'Storage & Usage';
      case 'about': return 'About NekoTick';
      default: return 'Settings';
    }
  };

  const getTabSubtitle = (tab: SettingsTab) => {
    switch (tab) {
      case 'appearance': return 'Customize your NekoTick appearance';
      case 'shortcuts': return 'View and customize keyboard shortcuts';
      case 'storage': return 'Manage local data and cloud sync';
      case 'about': return 'Version info and acknowledgments';
      default: return '';
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[100] backdrop-blur-[2px]"
            onClick={() => {
              onClose();
            }}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none p-4">
            {/* Global Window Drag Region (Top Strip) */}
            <div
              className="absolute top-0 left-0 right-0 h-14 z-[105] pointer-events-auto"
              onMouseDown={(e) => {
                // Only handle left click
                if (e.button !== 0) return;

                isDraggingRef.current = false;
                startPosRef.current = { x: e.clientX, y: e.clientY };
              }}
              onMouseMove={(e) => {
                // If already dragging or button not held, ignore
                if (isDraggingRef.current || e.buttons !== 1) return;

                const dx = e.clientX - startPosRef.current.x;
                const dy = e.clientY - startPosRef.current.y;

                // If user moves mouse noticeably (e.g. > 10px), trigger drag
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                  startDrag();
                }
              }}
              onMouseUp={() => {
                // If we didn't trigger a drag, it's a click
                if (!isDraggingRef.current) {
                  onClose();
                }
                // Reset dragging state for next interaction
                isDraggingRef.current = false;
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-[1080px] h-[720px] max-w-full max-h-[90vh] bg-white dark:bg-[#1C1C1C] rounded-[16px] shadow-2xl flex overflow-hidden pointer-events-auto ring-1 ring-black/5 dark:ring-white/5 select-none"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
              tabIndex={-1}
            >
              {/* Sidebar */}
              <div className="w-[260px] flex-shrink-0 bg-[#F7F7F7] dark:bg-[#141414] flex flex-col border-r border-[#EEEEEE] dark:border-[#2C2C2C]">
                {/* Header */}
                <div className="px-6 pt-8 pb-4">
                  <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-100">
                    Settings
                  </h2>
                </div>

                {/* User Profile Card */}
                <div className="px-3 pb-6 border-b border-transparent">
                  <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-default group">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-lg bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex-shrink-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={username || 'User'} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400">
                          <User className="w-5 h-5 text-zinc-400" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                          {isConnected && username ? username : 'Guest User'}
                        </span>
                        {/* Plan Badge */}
                        <span className={cn(
                          "px-1.5 py-[1px] rounded-[4px] text-[10px] font-bold tracking-tight uppercase",
                          isProUser
                            ? "bg-[#E6F4FF] text-[#007AFF] dark:bg-[#007AFF]/20 dark:text-[#0A84FF]"
                            : "bg-zinc-200/80 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        )}>
                          {isProUser ? 'PRO' : 'FREE'}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate opacity-80 group-hover:opacity-100 transition-opacity">
                        {isConnected ? 'Synced via GitHub' : 'Local Workspace'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto px-3 space-y-7 py-4">
                  {sidebarGroups.map((group) => (
                    <div key={group.title}>
                      <div className="px-4 mb-2">
                        <span className="text-[11px] font-bold text-zinc-400/80 dark:text-zinc-600 uppercase tracking-widest">
                          {group.title}
                        </span>
                      </div>
                      <div className="space-y-[2px]">
                        {group.items.map((item) => {
                          const isActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => setActiveTab(item.id)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3.5 py-2 rounded-[8px] text-[13px] font-medium transition-all duration-200 relative",
                                isActive
                                  ? "text-black dark:text-white shadow-[0_2px_4px_rgba(0,0,0,0.02),0_1px_0_rgba(0,0,0,0.02)]"
                                  : "text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-200"
                              )}
                            >
                              {isActive && (
                                <motion.div
                                  layoutId="sidebar-active"
                                  className="absolute inset-0 bg-white dark:bg-[#2C2C2C] rounded-[8px] ring-1 ring-black/5 dark:ring-white/5"
                                  style={{ zIndex: 0 }}
                                  transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                                />
                              )}
                              <span className="relative z-10 flex items-center justify-center">
                                <item.icon className={cn("w-[18px] h-[18px]", isActive ? "text-black dark:text-white" : "text-zinc-500 dark:text-zinc-500")} />
                              </span>
                              <span className="relative z-10">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#1E1E1E] relative">
                {/* Close Button - Floating top right */}
                <div className="absolute top-5 right-5 z-20">
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content Scroll Area */}
                <div className="flex-1 overflow-y-auto w-full neko-scrollbar">
                  <div className="px-12 py-10 max-w-[800px] w-full mx-auto">
                    {/* Page Header */}
                    <div className="mb-10">
                      <h1 className="text-[26px] font-bold text-[#111] dark:text-white mb-1.5 tracking-tight">
                        {getTabTitle(activeTab)}
                      </h1>
                      <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-lg">
                        {getTabSubtitle(activeTab)}
                      </p>
                    </div>

                    {/* Content */}
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      {activeTab === 'about' && <AboutTab />}
                      {activeTab === 'appearance' && <AppearanceTab />}
                      {activeTab === 'shortcuts' && (
                        <ShortcutsTab
                          shortcuts={shortcuts}
                          editingId={editingId}
                          recordingKeys={recordingKeys}
                          onStartEditing={startEditing}
                          onClearShortcut={clearShortcut}
                          onClearRecording={() => resetShortcutState()}
                        />
                      )}
                      {activeTab === 'storage' && <StorageTab />}
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
