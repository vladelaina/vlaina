import { useEffect, useMemo } from 'react';
import { desktopWindow } from '@/lib/desktop/window';
import { hasElectronDesktopBridge } from '@/lib/desktop/backend';
import { dispatchEditorFindOpenEvent } from '@/components/Notes/features/Editor/find/editorFindEvents';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore as useAppUIStore } from '@/stores/uiSlice';
import { getShortcuts, getKeysFromEvent, matchShortcut, ShortcutScope, ShortcutHandler } from '@/lib/shortcuts';
import { shouldBlockBrowserReservedShortcut } from '@/lib/shortcuts/browserGuards';
import { isEventInsideDialog } from '@/lib/shortcuts/dialogGuards';
import { dispatchSidebarOpenSearchEvent } from '@/components/layout/sidebar/sidebarEvents';
import { resolveSiblingNoteParentPath } from '@/stores/notes/notePathState';
import { dispatchDeleteCurrentNoteEvent } from '@/components/Notes/noteDeleteEvents';

interface UseShortcutsOptions {
  scope?: ShortcutScope;
  handlers?: Record<string, ShortcutHandler>;
}

function isEditableUndoTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest('[contenteditable="true"], .ProseMirror, .cm-editor')) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
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
  const { createNote, currentNote, saveNote, restoreLastDeletedItem } = useNotesStore();

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
      await desktopWindow.create({ viewMode: appViewMode });
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
    saveNote: async () => {
      await saveNote({ explicit: true });
    },
    deleteCurrentNote: () => {
      dispatchDeleteCurrentNoteEvent();
    },
    toggleDrawer,
  }), [toggleAppViewMode, toggleSidebar, setNotesSidebarView, notesSidebarView, createNote, currentNote?.path, saveNote, toggleDrawer, appViewMode]);

  const handlers = useMemo(() => ({
    ...builtinHandlers,
    ...extraHandlers,
  }), [builtinHandlers, extraHandlers]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        await desktopWindow.toggleFullscreen();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        await handlers.newWindow?.();
        return;
      }

      if (hasElectronDesktopBridge() && shouldBlockBrowserReservedShortcut(e)) {
        e.preventDefault();
        return;
      }

      if (isEventInsideDialog(e.target)) {
        return;
      }

      if (
        appViewMode === 'notes' &&
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === 'z' &&
        !isEditableUndoTarget(e.target) &&
        useNotesStore.getState().pendingDeletedItems.length > 0
      ) {
        e.preventDefault();
        await restoreLastDeletedItem();
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
  }, [scope, appViewMode, handlers, restoreLastDeletedItem]);
}
