import { useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useGroupStore, useUIStore } from '@/stores/useGroupStore';
import { useUnifiedStore } from '@/stores/useUnifiedStore';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore as useAppUIStore } from '@/stores/uiSlice';
import { getShortcuts, getKeysFromEvent, matchShortcut, ShortcutScope, ShortcutHandler } from '@/lib/shortcuts';

interface UseShortcutsOptions {
  scope?: ShortcutScope;
  handlers?: Record<string, ShortcutHandler>;
}

export function useShortcuts(options: UseShortcutsOptions = {}) {
  const { scope = 'global', handlers: extraHandlers = {} } = options;
  
  const { activeGroupId, archiveCompletedTasks, setActiveGroup } = useGroupStore();
  const undoLastAction = useUnifiedStore(state => state.undo);
  const { toggleDrawer } = useUIStore();
  const { toggleSidebar, toggleAIPanel, createNote, currentNote } = useNotesStore();
  const { appViewMode } = useAppUIStore();

  const builtinHandlers = useMemo<Record<string, ShortcutHandler>>(() => ({
    toggleSidebar,
    toggleAIPanel,
    newTab: () => {
      const folderPath = currentNote?.path 
        ? currentNote.path.substring(0, currentNote.path.lastIndexOf('/')) || undefined
        : undefined;
      createNote(folderPath);
    },
    toggleDrawer,
    archiveCompleted: async () => {
      if (activeGroupId && activeGroupId !== '__archive__') {
        await archiveCompletedTasks(activeGroupId);
      }
    },
    openArchive: () => setActiveGroup('__archive__'),
  }), [toggleSidebar, toggleAIPanel, createNote, currentNote?.path, toggleDrawer, activeGroupId, archiveCompletedTasks, setActiveGroup]);

  const handlers = useMemo(() => ({
    ...builtinHandlers,
    ...extraHandlers,
  }), [builtinHandlers, extraHandlers]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Fixed shortcuts (not customizable)
      if (e.key === 'F11') {
        e.preventDefault();
        await invoke('toggle_fullscreen').catch(console.error);
        return;
      }
      
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        undoLastAction();
        return;
      }

      const pressedKeys = getKeysFromEvent(e);
      if (pressedKeys.length < 2) return;
      
      const shortcuts = getShortcuts();
      
      for (const shortcut of shortcuts) {
        const shortcutScope = shortcut.scope || 'global';
        if (shortcutScope !== 'global' && shortcutScope !== scope) continue;
        if (shortcutScope === 'notes' && appViewMode !== 'notes') continue;
        
        if (matchShortcut(pressedKeys, shortcut)) {
          const handler = handlers[shortcut.id];
          if (handler) {
            e.preventDefault();
            await handler();
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scope, appViewMode, handlers, undoLastAction]);
}
