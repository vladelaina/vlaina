import { useEffect, useMemo } from 'react';
import { windowCommands } from '@/lib/tauri/invoke';
import { isTauri } from '@/lib/storage/adapter';
import { dispatchEditorFindOpenEvent } from '@/components/Notes/features/Editor/find/editorFindEvents';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore as useAppUIStore } from '@/stores/uiSlice';
import { getShortcuts, getKeysFromEvent, matchShortcut, ShortcutScope, ShortcutHandler } from '@/lib/shortcuts';
import { shouldBlockBrowserReservedShortcut } from '@/lib/shortcuts/browserGuards';
import { dispatchSidebarOpenSearchEvent } from '@/components/layout/sidebar/sidebarEvents';
import { resolveSiblingNoteParentPath } from '@/stores/notes/notePathState';

interface UseShortcutsOptions {
  scope?: ShortcutScope;
  handlers?: Record<string, ShortcutHandler>;
}

export function useShortcuts(options: UseShortcutsOptions = {}) {
  const { scope = 'global', handlers: extraHandlers = {} } = options;
  const {
    toggleDrawer,
    appViewMode,
    toggleAppViewMode,
    toggleSidebar,
    notesSidebarView,
    setNotesSidebarView,
  } = useAppUIStore();
  const { createNote, currentNote } = useNotesStore();

  const builtinHandlers = useMemo<Record<string, ShortcutHandler>>(() => ({
    toggleAppViewMode,
    toggleSidebar,
    toggleNotesSidebarView: () => {
      setNotesSidebarView(notesSidebarView === 'workspace' ? 'outline' : 'workspace');
    },
    sidebarSearch: () => {
      dispatchSidebarOpenSearchEvent();
    },
    editorFind: () => {
      dispatchEditorFindOpenEvent();
    },
    'open-settings': () => {
      window.dispatchEvent(new Event('open-settings'));
    },
    newWindow: async () => {
      await windowCommands.createNewWindow({ viewMode: appViewMode });
    },
    newTab: () => {
      const folderPath = resolveSiblingNoteParentPath(
        useNotesStore.getState().draftNotes,
        currentNote?.path,
      );
      createNote(folderPath);
    },
    openMarkdownFile: () => {
      window.dispatchEvent(new Event('vlaina-open-markdown-file'));
    },
    toggleDrawer,
  }), [toggleAppViewMode, toggleSidebar, setNotesSidebarView, notesSidebarView, createNote, currentNote?.path, toggleDrawer, appViewMode]);

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

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        await handlers.newWindow?.();
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
        if (scope !== 'global' && shortcutScope !== 'global' && shortcutScope !== scope) continue;
        if (shortcutScope === 'notes' && appViewMode !== 'notes') continue;
        if (shortcutScope === 'chat' && appViewMode !== 'chat') continue;
        
        if (matchShortcut(pressedKeys, shortcut)) {
          const handler = handlers[shortcut.id];
          if (!handler) continue;
          e.preventDefault();
          await handler();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scope, appViewMode, handlers]);
}
