export const CHAT_SELECTION_STREAM_FREEZE_EVENT = 'vlaina-chat-selection-stream-freeze';

export interface ChatSelectionStreamFreezeDetail {
  button: number;
  clientX?: number;
  clientY?: number;
  source: 'mousedown' | 'pointerdown';
  target: Element;
}

export function dispatchChatSelectionStreamFreeze(detail: ChatSelectionStreamFreezeDetail): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(CHAT_SELECTION_STREAM_FREEZE_EVENT, { detail }));
}

export function addChatSelectionStreamFreezeListener(
  listener: (detail: ChatSelectionStreamFreezeDetail) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleFreezeEvent = (event: Event) => {
    const detail = (event as CustomEvent<ChatSelectionStreamFreezeDetail>).detail;
    if (!detail || !(detail.target instanceof Element)) {
      return;
    }
    listener(detail);
  };

  window.addEventListener(CHAT_SELECTION_STREAM_FREEZE_EVENT, handleFreezeEvent);
  return () => {
    window.removeEventListener(CHAT_SELECTION_STREAM_FREEZE_EVENT, handleFreezeEvent);
  };
}
