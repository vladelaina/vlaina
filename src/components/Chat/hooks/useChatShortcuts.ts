import { useEffect } from 'react';
import { actions as aiActions } from '@/stores/useAIStore';
import { useUnifiedStore } from '@/stores/useUnifiedStore';

interface UseChatShortcutsOptions {
  onFocusInput: () => void;
  onToggleShortcuts: () => void;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function useChatShortcuts({ onFocusInput, onToggleShortcuts, scrollRef }: UseChatShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

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
