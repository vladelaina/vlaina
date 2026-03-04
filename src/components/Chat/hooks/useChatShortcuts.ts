import { useEffect } from 'react';
import { actions as aiActions } from '@/stores/useAIStore';
import { useUnifiedStore } from '@/stores/useUnifiedStore';
import { shouldBlockBrowserReservedShortcut } from '@/lib/shortcuts/browserGuards';

interface UseChatShortcutsOptions {
  onFocusInput: () => void;
  onToggleShortcuts: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export function useChatShortcuts({ onFocusInput, onToggleShortcuts, scrollRef }: UseChatShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (shouldBlockBrowserReservedShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (isMod && e.key === '/') {
        e.preventDefault();
        onToggleShortcuts();
        return;
      }

      if (e.shiftKey && e.key === 'Escape') {
        e.preventDefault();
        onFocusInput();
        return;
      }

      if (isMod && e.shiftKey && key === 'o') {
        e.preventDefault();
        aiActions.openNewChat();
        onFocusInput();
        return;
      }

      if (isMod && e.shiftKey && key === 'j') {
        e.preventDefault();
        const state = useUnifiedStore.getState();
        const aiState = state.data.ai;
        const temporaryEnabled = !!aiState?.temporaryChatEnabled;
        const currentSessionId = aiState?.currentSessionId || null;
        const currentMessages = currentSessionId ? (aiState?.messages?.[currentSessionId] || []) : [];
        const isCurrentTemporaryChatEmpty = temporaryEnabled && currentMessages.length === 0;

        if (!temporaryEnabled) {
          aiActions.toggleTemporaryChat(true);
        } else if (isCurrentTemporaryChatEmpty) {
          aiActions.toggleTemporaryChat(false);
        } else {
          aiActions.createSession('New Chat');
        }

        onFocusInput();
        return;
      }

      if (e.shiftKey && e.key === 'ArrowUp') {
        e.preventDefault();
        navigateMessages('prev');
        return;
      }

      if (e.shiftKey && e.key === 'ArrowDown') {
        e.preventDefault();
        navigateMessages('next');
        return;
      }

      // Session Switching: Ctrl+Tab (Next) / Ctrl+Shift+Tab (Prev)
      // Only enable in Tauri environment to avoid hijacking browser tab switching
      if (isMod && e.key === 'Tab') {
          // Check for Tauri environment (v1 or v2)
          const isTauri = typeof window !== 'undefined' && 
              ('__TAURI_IPC__' in window || '__TAURI_INTERNALS__' in window || '__TAURI__' in window);
          
          if (!isTauri) return;

          e.preventDefault();
          const state = useUnifiedStore.getState();
          const rawSessions = state.data.ai?.sessions || [];
          const currentId = state.data.ai?.currentSessionId;
          
          if (rawSessions.length < 2) return;

          // Sort sessions to match visual order (updatedAt desc)
          const sessions = [...rawSessions].sort((a, b) => b.updatedAt - a.updatedAt);

          const currentIndex = sessions.findIndex(s => s.id === currentId);
          // Note: sessions are usually ordered by date desc, so visual order depends on Sidebar.
          // Assuming sessions list matches sidebar visual order.
          let nextIndex;

          if (e.shiftKey) {
              // Prev (Up/Left)
              nextIndex = currentIndex > 0 ? currentIndex - 1 : sessions.length - 1;
          } else {
              // Next (Down/Right)
              nextIndex = currentIndex < sessions.length - 1 ? currentIndex + 1 : 0;
          }

          const nextId = sessions[nextIndex].id;
          aiActions.switchSession(nextId);
          onFocusInput();
          return;
      }

      const state = useUnifiedStore.getState();
      const ai = state.data.ai;
      if (!ai || !ai.currentSessionId) return;

      const currentId = ai.currentSessionId;
      const currentMsgs = ai.messages[currentId] || [];

      if (isMod && e.shiftKey && e.key === 'Backspace') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('neko-delete-chat', { detail: { id: currentId } }));
        return;
      }

      if (isMod && e.shiftKey && key === 'c') {
        e.preventDefault();
        const lastAI = [...currentMsgs].reverse().find(m => m.role === 'assistant');
        if (lastAI) {
          navigator.clipboard.writeText(lastAI.content);
        }
        return;
      }

      if (isMod && e.shiftKey && (e.key === ';' || e.key === ':')) {
        e.preventDefault();
        const lastAI = [...currentMsgs].reverse().find(m => m.role === 'assistant');
        if (lastAI) {
          const codeBlockRegex = /```[\s\S]*?```/g;
          const matches = lastAI.content.match(codeBlockRegex);
          if (matches && matches.length > 0) {
            const lastCode = matches[matches.length - 1]
              .replace(/```\w*\n?/, '')
              .replace(/```$/, '');
            navigator.clipboard.writeText(lastCode);
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
  }, [onFocusInput, onToggleShortcuts, scrollRef]);
}
