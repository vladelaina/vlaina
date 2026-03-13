import { useEffect, useMemo } from 'react';
import { windowCommands } from '@/lib/tauri/invoke';
import { isTauri } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore as useAppUIStore } from '@/stores/uiSlice';
import { getShortcuts, getKeysFromEvent, matchShortcut, ShortcutScope, ShortcutHandler } from '@/lib/shortcuts';
import { shouldBlockBrowserReservedShortcut } from '@/lib/shortcuts/browserGuards';

interface UseShortcutsOptions {
  scope?: ShortcutScope;
  handlers?: Record<string, ShortcutHandler>;
}

export function useShortcuts(options: UseShortcutsOptions = {}) {
  const { scope = 'global', handlers: extraHandlers = {} } = options;
  const { toggleDrawer, appViewMode, toggleSidebar } = useAppUIStore();
  const { createNote, currentNote } = useNotesStore();

  const builtinHandlers = useMemo<Record<string, ShortcutHandler>>(() => ({
    toggleSidebar,
    globalSearch: () => {
      window.dispatchEvent(new Event('neko-open-search'));
    },
    'open-settings': () => {
      window.dispatchEvent(new Event('open-settings'));
    },
    newWindow: async () => {
      await windowCommands.createNewWindow();
    },
    newTab: () => {
      const folderPath = currentNote?.path 
        ? currentNote.path.substring(0, currentNote.path.lastIndexOf('/')) || undefined
        : undefined;
      createNote(folderPath);
    },
    toggleDrawer,
  }), [toggleSidebar, createNote, currentNote?.path, toggleDrawer]);

  const handlers = useMemo(() => ({
    ...builtinHandlers,
    ...extraHandlers,
  }), [builtinHandlers, extraHandlers]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        await windowCommands.toggleFullscreen();
        return;
      }

      if (isTauri() && shouldBlockBrowserReservedShortcut(e)) {
        e.preventDefault();
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
  }, [scope, appViewMode, handlers]);
}
