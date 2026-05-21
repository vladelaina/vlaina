import { useEffect } from 'react';
import { hasElectronDesktopBridge } from '@/lib/desktop/backend';
import { actions as aiActions } from '@/stores/useAIStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { isToggleShortcutsBinding, matchesShortcutBinding } from '@/lib/shortcuts';
import { shouldBlockBrowserReservedShortcut } from '@/lib/shortcuts/browserGuards';
import { isEventInsideDialog } from '@/lib/shortcuts/dialogGuards';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import { writeTextToClipboard } from '@/lib/clipboard';
import { dispatchChatMessageCopied } from '@/components/Chat/common/copyFeedback';
import { copyMessageContentToClipboard } from '@/components/Chat/common/messageClipboard';
import { isComposerFocusTarget, selectComposerInputAll } from '@/lib/ui/composerFocusRegistry';
import {
  runOpenNewChatShortcut,
  runTemporaryChatWelcomeShortcut,
} from '@/components/Chat/features/Temporary/temporaryChatCommands';
import { getNavigableChatSidebarSessions } from '@/components/Chat/features/Sidebar/chatSidebarSearch';
import {
  getMarkdownFenceState,
  isMarkdownFenceClose,
  type MarkdownFenceState,
} from '@/components/Chat/features/Layout/chatAssistantMarkdownBlockParser';

interface UseChatShortcutsOptions {
  onFocusInput: () => void;
  onToggleShortcuts: () => void;
  onStopGeneration?: () => void;
  isGenerating?: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export function extractLastFencedCodeBlock(markdown: string): string | null {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let activeFence: MarkdownFenceState | null = null;
  let activeCodeLines: string[] = [];
  let lastCodeBlock: string | null = null;

  for (const line of lines) {
    if (activeFence) {
      if (isMarkdownFenceClose(line, activeFence)) {
        lastCodeBlock = activeCodeLines.join('\n');
        activeFence = null;
        activeCodeLines = [];
        continue;
      }

      activeCodeLines.push(line);
      continue;
    }

    const fence = getMarkdownFenceState(line);
    if (fence) {
      activeFence = fence;
      activeCodeLines = [];
    }
  }

  return lastCodeBlock;
}

export function useChatShortcuts(
  { onFocusInput, onToggleShortcuts, onStopGeneration, isGenerating = false, scrollRef }: UseChatShortcutsOptions,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      if (target instanceof HTMLInputElement) return true;
      if (target instanceof HTMLTextAreaElement) return true;
      if ((target as HTMLElement).isContentEditable) return true;
      return !!target.closest('[contenteditable="true"]');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (shouldBlockBrowserReservedShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (isToggleShortcutsBinding(e)) {
        e.preventDefault();
        onToggleShortcuts();
        return;
      }

      if (isEventInsideDialog(e.target)) {
        return;
      }

      if (matchesShortcutBinding(e, 'stopResponse') && isGenerating) {
        e.preventDefault();
        e.stopPropagation();
        onStopGeneration?.();
        return;
      }

      if (matchesShortcutBinding(e, 'focusChatInput')) {
        e.preventDefault();
        onFocusInput();
        return;
      }

      if (matchesShortcutBinding(e, 'openNewChat')) {
        e.preventDefault();
        runOpenNewChatShortcut();
        onFocusInput();
        return;
      }

      if (isMod && !e.shiftKey && !e.altKey && key === 'a') {
        if (isEditableTarget(e.target) && !isComposerFocusTarget(e.target)) {
          return;
        }
        e.preventDefault();
        if (!selectComposerInputAll()) {
          onFocusInput();
        }
        return;
      }

      if (matchesShortcutBinding(e, 'toggleTemporaryChatWelcome')) {
        e.preventDefault();
        runTemporaryChatWelcomeShortcut();
        onFocusInput();
        return;
      }

      if (matchesShortcutBinding(e, 'previousMessage')) {
        if (isEditableTarget(e.target)) {
          return;
        }
        e.preventDefault();
        navigateMessages('prev');
        return;
      }

      if (matchesShortcutBinding(e, 'nextMessage')) {
        if (isEditableTarget(e.target)) {
          return;
        }
        e.preventDefault();
        navigateMessages('next');
        return;
      }

      if (matchesShortcutBinding(e, 'nextChatSession') || matchesShortcutBinding(e, 'previousChatSession')) {
          if (!hasElectronDesktopBridge()) return;

          e.preventDefault();
          const state = useUnifiedStore.getState();
          const sessions = getNavigableChatSidebarSessions(state.data.ai?.sessions || []);
          const currentId = useAIUIStore.getState().currentSessionId;
          
          if (sessions.length < 2) return;

          const currentIndex = sessions.findIndex((session) => session.id === currentId);
          let nextIndex;

          if (matchesShortcutBinding(e, 'previousChatSession')) {
              nextIndex = currentIndex > 0 ? currentIndex - 1 : sessions.length - 1;
          } else {
              nextIndex = currentIndex < sessions.length - 1 ? currentIndex + 1 : 0;
          }

          const nextId = sessions[nextIndex]?.id;
          if (!nextId) return;
          aiActions.switchSession(nextId);
          onFocusInput();
          return;
      }

      const state = useUnifiedStore.getState();
      const ai = state.data.ai;
      const currentId = useAIUIStore.getState().currentSessionId;
      if (!ai || !currentId) return;

      const currentMsgs = ai.messages[currentId] || [];

      if (matchesShortcutBinding(e, 'deleteChat')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('vlaina-delete-chat', { detail: { id: currentId } }));
        return;
      }

      if (matchesShortcutBinding(e, 'copyLastResponse')) {
        e.preventDefault();
        const lastAI = [...currentMsgs].reverse().find(m => m.role === 'assistant');
        if (lastAI) {
          try {
            const copyRequest = copyMessageContentToClipboard(stripThinkingContent(lastAI.content));
            void Promise.resolve(copyRequest)
              .then((didCopy) => {
                if (didCopy) {
                  dispatchChatMessageCopied(lastAI.id);
                }
              })
              .catch((_error) => {
              });
          } catch (error) {
          }
        }
        return;
      }

      if (matchesShortcutBinding(e, 'copyLastCodeBlock')) {
        e.preventDefault();
        const lastAI = [...currentMsgs].reverse().find(m => m.role === 'assistant');
        if (lastAI) {
          const visibleContent = stripThinkingContent(lastAI.content);
          const lastCode = extractLastFencedCodeBlock(visibleContent);
          if (lastCode !== null) {
            try {
              const copyRequest = writeTextToClipboard(lastCode);
              void Promise.resolve(copyRequest)
                .catch((_error) => {
                });
            } catch (error) {
            }
          }
        }
        return;
      }
    };

    const navigateMessages = (dir: 'prev' | 'next') => {
        const container = scrollRef.current;
        if (!container) return;
        
        const items = Array.from(container.querySelectorAll('[data-message-item="true"][data-role="user"]')) as HTMLElement[];
        if (items.length === 0) return;

        const currentScroll = container.scrollTop;
        const buffer = 30; 
        
        let target: HTMLElement | undefined;

        if (dir === 'prev') {
            for (let i = items.length - 1; i >= 0; i--) {
                if (items[i].offsetTop < currentScroll - buffer) {
                    target = items[i];
                    break;
                }
            }
        } else {
            for (let i = 0; i < items.length; i++) {
                if (items[i].offsetTop > currentScroll + buffer) {
                    target = items[i];
                    break;
                }
            }
        }
        
        if (target) {
            const topPadding = 20;
            const targetPosition = target.offsetTop - topPadding;
            container.scrollTo({ top: targetPosition, behavior: 'smooth' });
        } else if (dir === 'prev') {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (dir === 'next') {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, isGenerating, onFocusInput, onStopGeneration, onToggleShortcuts, scrollRef]);
}
