import { useEffect } from 'react';
import { matchesShortcutBinding } from '@/lib/shortcuts';
import { isEventInsideDialog, isEventInsideNotesChatSurface } from '@/lib/shortcuts/dialogGuards';
import {
  isEditableShortcutTarget,
  shouldSkipShortcutForEditableSystemShortcut,
} from '@/lib/shortcuts/editableGuards';
import {
  runOpenNewChatShortcut,
  runTemporaryChatWelcomeShortcut,
} from '@/components/Chat/features/Temporary/temporaryChatCommands';
import { focusComposerInput } from '@/lib/ui/composerFocusRegistry';
import { getAdjacentTreeNotePath } from '@/components/Notes/features/common/noteTreeNavigation';
import {
  canOpenSidebarDiscussionForSelection,
  openSidebarDiscussionForSelection,
} from '@/components/Notes/features/Editor/plugins/floating-toolbar/ai/sidebarDiscussion';
import { getCurrentEditorView } from '@/components/Notes/features/Editor/utils/editorViewRegistry';
import { dispatchNoteSourceModeToggleEvent } from '@/components/Notes/features/Editor/sourceMode/sourceModeEvents';
import { dispatchEditorFindOpenEvent } from '@/components/Notes/features/Editor/find/editorFindEvents';

interface UseNotesViewShortcutsOptions {
  active: boolean;
  currentNotePath: string | null | undefined;
  openTabs: Array<{ path: string }>;
  notePathsInTreeOrder: readonly string[];
  openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
  closeTab: (path: string) => Promise<void>;
  reopenClosedTab: () => Promise<void>;
  chatPanelCollapsed: boolean;
  chatFloatingOpen: boolean;
  closeChatPanel: () => void;
  closeFloatingChat: () => void;
  openFloatingChat: () => void;
  focusNotesChatComposer: () => void;
  focusSidebarPath: (path: string) => void;
  saveNote: (options?: { explicit?: boolean }) => Promise<void>;
}

export function useNotesViewShortcuts({
  active,
  currentNotePath,
  openTabs,
  notePathsInTreeOrder,
  openNote,
  closeTab,
  reopenClosedTab,
  chatPanelCollapsed,
  chatFloatingOpen,
  closeChatPanel,
  closeFloatingChat,
  openFloatingChat,
  focusNotesChatComposer,
  focusSidebarPath,
  saveNote,
}: UseNotesViewShortcutsOptions) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || shouldSkipShortcutForEditableSystemShortcut(event)) {
        return;
      }

      if (isEventInsideDialog(event.target)) {
        return;
      }

      const isInsideNotesChatSurface = isEventInsideNotesChatSurface(event.target);
      const isInsideNoteEditor = event.target instanceof Element && Boolean(
        event.target.closest('[data-note-content-root="true"]')
      );
      if (
        isInsideNoteEditor &&
        matchesShortcutBinding(event, 'toggleNoteSourceMode')
      ) {
        event.preventDefault();
        dispatchNoteSourceModeToggleEvent();
        return;
      }
      if (
        isInsideNoteEditor &&
        matchesShortcutBinding(event, 'editorFind')
      ) {
        event.preventDefault();
        dispatchEditorFindOpenEvent();
        return;
      }
      if (
        !isInsideNotesChatSurface &&
        (!isEditableShortcutTarget(event.target) || isInsideNoteEditor) &&
        matchesShortcutBinding(event, 'toggleEmbeddedChat')
      ) {
        event.preventDefault();
        if (!chatPanelCollapsed) {
          closeChatPanel();
          return;
        }

        if (chatFloatingOpen) {
          closeFloatingChat();
          return;
        }

        const currentEditorView = getCurrentEditorView();
        if (currentEditorView && canOpenSidebarDiscussionForSelection(currentEditorView)) {
          openSidebarDiscussionForSelection(currentEditorView);
          return;
        }

        openFloatingChat();
        return;
      }
      if (
        isInsideNoteEditor &&
        matchesShortcutBinding(event, 'saveNote')
      ) {
        event.preventDefault();
        void saveNote({ explicit: true });
        return;
      }
      if (isEditableShortcutTarget(event.target) && !isInsideNotesChatSurface) {
        return;
      }

      const focusChatComposerAfterShortcut = () => {
        if (!isInsideNotesChatSurface || !chatFloatingOpen) {
          focusNotesChatComposer();
          return;
        }

        requestAnimationFrame(() => {
          focusComposerInput();
        });
      };

      if (matchesShortcutBinding(event, 'openNewChat')) {
        event.preventDefault();
        runOpenNewChatShortcut();
        focusChatComposerAfterShortcut();
        return;
      }

      if (matchesShortcutBinding(event, 'toggleTemporaryChatWelcome')) {
        event.preventDefault();
        runTemporaryChatWelcomeShortcut();
        focusChatComposerAfterShortcut();
        return;
      }

      if (isInsideNotesChatSurface) {
        return;
      }

      if (matchesShortcutBinding(event, 'toggleNoteSourceMode')) {
        event.preventDefault();
        dispatchNoteSourceModeToggleEvent();
        return;
      }

      if (matchesShortcutBinding(event, 'nextNoteTab')) {
        event.preventDefault();
        if (!currentNotePath) {
          return;
        }

        if (openTabs.length > 1) {
          const currentIndex = openTabs.findIndex((tab) => tab.path === currentNotePath);
          if (currentIndex === -1) {
            return;
          }
          const nextPath = openTabs[currentIndex === openTabs.length - 1 ? 0 : currentIndex + 1]?.path;
          if (!nextPath) {
            return;
          }
          void openNote(nextPath).catch(() => undefined);
          return;
        }

        const nextPath = getAdjacentTreeNotePath(notePathsInTreeOrder, currentNotePath, 'next');
        if (nextPath) {
          focusSidebarPath(nextPath);
          void openNote(nextPath).catch(() => undefined);
        }
        return;
      }

      if (matchesShortcutBinding(event, 'previousNoteTab')) {
        event.preventDefault();
        if (!currentNotePath) {
          return;
        }

        if (openTabs.length > 1) {
          const currentIndex = openTabs.findIndex((tab) => tab.path === currentNotePath);
          if (currentIndex === -1) {
            return;
          }
          const nextPath = openTabs[currentIndex === 0 ? openTabs.length - 1 : currentIndex - 1]?.path;
          if (!nextPath) {
            return;
          }
          void openNote(nextPath).catch(() => undefined);
          return;
        }

        const nextPath = getAdjacentTreeNotePath(notePathsInTreeOrder, currentNotePath, 'previous');
        if (nextPath) {
          focusSidebarPath(nextPath);
          void openNote(nextPath).catch(() => undefined);
        }
        return;
      }

      if (matchesShortcutBinding(event, 'closeCurrentTab') && currentNotePath) {
        event.preventDefault();
        void closeTab(currentNotePath).catch(() => undefined);
        return;
      }

      if (matchesShortcutBinding(event, 'reopenClosedTab')) {
        event.preventDefault();
        void reopenClosedTab().catch(() => undefined);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    active,
    chatFloatingOpen,
    chatPanelCollapsed,
    closeChatPanel,
    closeFloatingChat,
    closeTab,
    reopenClosedTab,
    currentNotePath,
    focusNotesChatComposer,
    focusSidebarPath,
    notePathsInTreeOrder,
    openNote,
    openFloatingChat,
    openTabs,
    saveNote,
  ]);
}
