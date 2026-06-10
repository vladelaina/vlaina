import { useEffect } from 'react';
import { matchesShortcutBinding } from '@/lib/shortcuts';
import { isEventInsideDialog } from '@/lib/shortcuts/dialogGuards';
import { shouldSkipShortcutForEditableSystemShortcut } from '@/lib/shortcuts/editableGuards';
import {
  runOpenNewChatShortcut,
  runTemporaryChatWelcomeShortcut,
} from '@/components/Chat/features/Temporary/temporaryChatCommands';
import { getAdjacentTreeNotePath } from '@/components/Notes/features/common/noteTreeNavigation';
import {
  canOpenSidebarDiscussionForSelection,
  openSidebarDiscussionForSelection,
} from '@/components/Notes/features/Editor/plugins/floating-toolbar/ai/sidebarDiscussion';
import { getCurrentEditorView } from '@/components/Notes/features/Editor/utils/editorViewRegistry';

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
}: UseNotesViewShortcutsOptions) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || shouldSkipShortcutForEditableSystemShortcut(event)) {
        return;
      }

      if (isEventInsideDialog(event.target)) {
        return;
      }

      if (matchesShortcutBinding(event, 'toggleEmbeddedChat')) {
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

      if (matchesShortcutBinding(event, 'openNewChat')) {
        event.preventDefault();
        runOpenNewChatShortcut();
        focusNotesChatComposer();
        return;
      }

      if (matchesShortcutBinding(event, 'toggleTemporaryChatWelcome')) {
        event.preventDefault();
        runTemporaryChatWelcomeShortcut();
        focusNotesChatComposer();
        return;
      }

      const target = event.target;
      if (target instanceof Element && target.closest('[data-notes-chat-panel="true"]')) {
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
          void openNote(nextPath);
          return;
        }

        const nextPath = getAdjacentTreeNotePath(notePathsInTreeOrder, currentNotePath, 'next');
        if (nextPath) {
          focusSidebarPath(nextPath);
          void openNote(nextPath);
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
          void openNote(nextPath);
          return;
        }

        const nextPath = getAdjacentTreeNotePath(notePathsInTreeOrder, currentNotePath, 'previous');
        if (nextPath) {
          focusSidebarPath(nextPath);
          void openNote(nextPath);
        }
        return;
      }

      if (matchesShortcutBinding(event, 'closeCurrentTab') && currentNotePath) {
        event.preventDefault();
        void closeTab(currentNotePath);
        return;
      }

      if (matchesShortcutBinding(event, 'reopenClosedTab')) {
        event.preventDefault();
        void reopenClosedTab();
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
  ]);
}
