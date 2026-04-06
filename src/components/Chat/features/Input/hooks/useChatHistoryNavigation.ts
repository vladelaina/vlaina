import { useCallback, useState } from 'react';

interface HistoryKeyInput {
  key: string;
  selectionStart: number;
  selectionEnd: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
}

interface UseChatHistoryNavigationOptions {
  message: string;
  sentUserMessages: string[];
  showMentionPicker: boolean;
  applyHistoryMessage: (message: string) => void;
}

export function useChatHistoryNavigation({
  message,
  sentUserMessages,
  showMentionPicker,
  applyHistoryMessage,
}: UseChatHistoryNavigationOptions) {
  const [historyBrowseIndex, setHistoryBrowseIndex] = useState<number | null>(null);
  const [historyDraftMessage, setHistoryDraftMessage] = useState('');

  const resetHistoryNavigation = useCallback(() => {
    setHistoryBrowseIndex(null);
    setHistoryDraftMessage('');
  }, []);

  const clearHistoryNavigationOnInput = useCallback(() => {
    if (historyBrowseIndex === null && !historyDraftMessage) {
      return;
    }

    resetHistoryNavigation();
  }, [historyBrowseIndex, historyDraftMessage, resetHistoryNavigation]);

  const handleHistoryKeyDown = useCallback(
    ({
      key,
      selectionStart,
      selectionEnd,
      shiftKey,
      altKey,
      ctrlKey,
      metaKey,
      preventDefault,
    }: HistoryKeyInput) => {
      const hasHistoryItems = sentUserMessages.length > 0;
      const hasModifier = shiftKey || altKey || ctrlKey || metaKey;
      const isCollapsedSelection = selectionStart === selectionEnd;

      if (showMentionPicker || !hasHistoryItems || hasModifier || !isCollapsedSelection) {
        return false;
      }

      if (key === 'ArrowUp' && (selectionStart === 0 || historyBrowseIndex !== null)) {
        preventDefault();
        const latestIndex = sentUserMessages.length - 1;
        const nextIndex = historyBrowseIndex === null
          ? latestIndex
          : Math.max(0, Math.min(historyBrowseIndex - 1, latestIndex));

        if (historyBrowseIndex === null) {
          setHistoryDraftMessage(message);
        }

        setHistoryBrowseIndex(nextIndex);
        applyHistoryMessage(sentUserMessages[nextIndex] ?? '');
        return true;
      }

      if (key === 'ArrowDown' && historyBrowseIndex !== null) {
        preventDefault();
        const latestIndex = sentUserMessages.length - 1;

        if (historyBrowseIndex < latestIndex) {
          const nextIndex = historyBrowseIndex + 1;
          setHistoryBrowseIndex(nextIndex);
          applyHistoryMessage(sentUserMessages[nextIndex] ?? '');
          return true;
        }

        setHistoryBrowseIndex(null);
        applyHistoryMessage(historyDraftMessage);
        setHistoryDraftMessage('');
        return true;
      }

      return false;
    },
    [
      applyHistoryMessage,
      historyBrowseIndex,
      historyDraftMessage,
      message,
      sentUserMessages,
      showMentionPicker,
    ]
  );

  return {
    historyBrowseIndex,
    resetHistoryNavigation,
    clearHistoryNavigationOnInput,
    handleHistoryKeyDown,
  };
}
