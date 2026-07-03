import { useEffect } from 'react';
import { hasElectronDesktopBridge } from '@/lib/desktop/backend';
import { actions as aiActions } from '@/stores/useAIStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { isToggleShortcutsBinding, matchesShortcutBinding } from '@/lib/shortcuts';
import { shouldBlockBrowserReservedShortcut } from '@/lib/shortcuts/browserGuards';
import { isEventInsideDialog } from '@/lib/shortcuts/dialogGuards';
import {
  isEditableShortcutTarget,
  shouldSkipShortcutForEditableSystemShortcut,
} from '@/lib/shortcuts/editableGuards';
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

export const MAX_CHAT_SHORTCUT_MESSAGE_SCAN_ELEMENTS = 20_000;
export const MAX_CHAT_SHORTCUT_CODE_BLOCK_SCAN_CHARS = 256 * 1024;
export const MAX_CHAT_SHORTCUT_CODE_BLOCK_COPY_CHARS = 256 * 1024;

interface UseChatShortcutsOptions {
  onFocusInput: () => void;
  onToggleShortcuts: () => void;
  onStopGeneration?: () => void;
  isGenerating?: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export function extractLastFencedCodeBlock(markdown: string): string | null {
  let activeFence: MarkdownFenceState | null = null;
  let activeCodeLines: string[] = [];
  let activeCodeChars = 0;
  let activeCodeOversized = false;
  let lastCodeBlock: string | null = null;
  const scanStart = getMarkdownTailScanStart(markdown, MAX_CHAT_SHORTCUT_CODE_BLOCK_SCAN_CHARS);

  forEachNormalizedMarkdownLine(markdown, (line) => {
    if (activeFence) {
      if (isMarkdownFenceClose(line, activeFence)) {
        if (!activeCodeOversized) {
          lastCodeBlock = activeCodeLines.join('\n');
        }
        activeFence = null;
        activeCodeLines = [];
        activeCodeChars = 0;
        activeCodeOversized = false;
        return;
      }

      activeCodeChars += line.length + (activeCodeLines.length > 0 ? 1 : 0);
      if (activeCodeChars <= MAX_CHAT_SHORTCUT_CODE_BLOCK_COPY_CHARS) {
        activeCodeLines.push(line);
      } else {
        activeCodeLines = [];
        activeCodeOversized = true;
      }
      return;
    }

    const fence = getMarkdownFenceState(line);
    if (fence) {
      activeFence = fence;
      activeCodeLines = [];
      activeCodeChars = 0;
      activeCodeOversized = false;
    }
  }, scanStart);

  return lastCodeBlock;
}

function getMarkdownTailScanStart(markdown: string, maxScanChars: number): number {
  if (markdown.length <= maxScanChars) {
    return 0;
  }
  const start = markdown.length - maxScanChars;
  const newline = markdown.indexOf('\n', start);
  return newline >= 0 ? newline + 1 : start;
}

function forEachNormalizedMarkdownLine(markdown: string, visit: (line: string) => void, start = 0): void {
  let lineStart = Math.max(0, Math.min(start, markdown.length));
  for (let index = lineStart; index < markdown.length; index += 1) {
    const character = markdown[index];
    if (character !== '\n' && character !== '\r') continue;

    visit(markdown.slice(lineStart, index));
    if (character === '\r' && markdown[index + 1] === '\n') {
      index += 1;
    }
    lineStart = index + 1;
  }
  visit(markdown.slice(lineStart));
}

function findLastAssistantMessage<T extends { role?: string }>(messages: T[]): T | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'assistant') {
      return message;
    }
  }
  return null;
}

export function useChatShortcuts(
  { onFocusInput, onToggleShortcuts, onStopGeneration, isGenerating = false, scrollRef }: UseChatShortcutsOptions,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) {
        return;
      }
      if (e.isComposing) {
        return;
      }

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

      if (shouldSkipShortcutForEditableSystemShortcut(e)) {
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
        if (isEditableShortcutTarget(e.target) && !isComposerFocusTarget(e.target)) {
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
        if (isEditableShortcutTarget(e.target)) {
          return;
        }
        e.preventDefault();
        navigateMessages('prev');
        return;
      }

      if (matchesShortcutBinding(e, 'nextMessage')) {
        if (isEditableShortcutTarget(e.target)) {
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
        window.dispatchEvent(new CustomEvent('app-delete-chat', { detail: { id: currentId } }));
        return;
      }

      if (matchesShortcutBinding(e, 'copyLastResponse')) {
        e.preventDefault();
        const lastAI = findLastAssistantMessage(currentMsgs);
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
        const lastAI = findLastAssistantMessage(currentMsgs);
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
        
        const currentScroll = container.scrollTop;
        const buffer = 30; 
        const ownerDocument = container.ownerDocument ?? document;
        const walker = ownerDocument.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
        let target: HTMLElement | undefined;
        let hasUserMessage = false;
        let scanned = 0;

        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            scanned += 1;
            if (scanned > MAX_CHAT_SHORTCUT_MESSAGE_SCAN_ELEMENTS) break;
            if (
                !(node instanceof HTMLElement) ||
                node.dataset.messageItem !== 'true' ||
                node.dataset.role !== 'user'
            ) {
                continue;
            }

            hasUserMessage = true;
            if (dir === 'prev') {
                if (node.offsetTop < currentScroll - buffer) {
                    target = node;
                }
                continue;
            }

            if (node.offsetTop > currentScroll + buffer) {
                target = node;
                break;
            }
        }

        if (!hasUserMessage) return;
        
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
