import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/ai/types';
import {
  MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
  MAX_CHAT_MESSAGE_IMAGE_SOURCES,
} from '@/components/Chat/common/messageClipboard';
import { extractChatMessageImageSources } from '@/lib/ai/chatImageSourcePolicy';

export interface ChatImageGalleryItem {
  id: string;
  src: string;
}

type DerivedCollection<T> = {
  items: T[];
  signature: string;
};

type DerivedState = {
  imageGallery: DerivedCollection<ChatImageGalleryItem>;
  sentUserMessages: DerivedCollection<string>;
  messageCache: Map<string, CachedMessageDerivatives>;
};

const DERIVATIVE_BATCH_SIZE = 80;
export const MAX_CHAT_DERIVATIVE_SIGNATURE_HASH_CHARS = 8192;

interface CachedMessageDerivatives {
  message: ChatMessage;
  imageGallery: DerivedCollection<ChatImageGalleryItem>;
  sentUserMessages: DerivedCollection<string>;
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function getDerivativeSignatureValue(value: string): string {
  if (value.length <= MAX_CHAT_DERIVATIVE_SIGNATURE_HASH_CHARS) {
    return `${value.length}:${hashString(value)}`;
  }

  const edgeLength = Math.floor(MAX_CHAT_DERIVATIVE_SIGNATURE_HASH_CHARS / 2);
  const sampledValue = `${value.slice(0, edgeLength)}\u0000${value.slice(-edgeLength)}`;
  return `${value.length}:large:${hashString(sampledValue)}`;
}

function buildMessageImageGallery(message: ChatMessage): DerivedCollection<ChatImageGalleryItem> {
  if (message.role !== 'assistant') {
    return { items: [], signature: '' };
  }

  const renderableSources = extractChatMessageImageSources(message.content || '', {
    maxSources: MAX_CHAT_MESSAGE_IMAGE_SOURCES,
    maxTokens: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
  });

  if (renderableSources.length === 0) {
    return { items: [], signature: '' };
  }

  return {
    items: renderableSources.map((src, index) => ({
      id: `${message.id}:${index}`,
      src,
    })),
    signature: `${message.id}\u0000${renderableSources.length}\u0000${renderableSources.map(getDerivativeSignatureValue).join('\u0002')}`,
  };
}

function buildMessageSentUserMessages(message: ChatMessage): DerivedCollection<string> {
  if (message.role !== 'user') {
    return { items: [], signature: '' };
  }

  const content = message.content.trim();
  if (!content) {
    return { items: [], signature: '' };
  }

  return {
    items: [message.content],
    signature: `${message.id}\u0000${message.currentVersionIndex}\u0000${getDerivativeSignatureValue(message.content)}`,
  };
}

function buildMessageDerivatives(message: ChatMessage): CachedMessageDerivatives {
  return {
    message,
    imageGallery: buildMessageImageGallery(message),
    sentUserMessages: buildMessageSentUserMessages(message),
  };
}

function getCachedMessageDerivatives(
  cache: Map<string, CachedMessageDerivatives>,
  message: ChatMessage,
): CachedMessageDerivatives {
  const cached = cache.get(message.id);
  if (cached?.message === message) {
    return cached;
  }

  const next = buildMessageDerivatives(message);
  cache.set(message.id, next);
  return next;
}

export function useStableChatMessageDerivatives(messages: ChatMessage[]): {
  imageGallery: ChatImageGalleryItem[];
  sentUserMessages: string[];
} {
  const [, bumpRevision] = useState(0);
  const stateRef = useRef<DerivedState>({
    imageGallery: {
      items: [],
      signature: '',
    },
    sentUserMessages: {
      items: [],
      signature: '',
    },
    messageCache: new Map(),
  });
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    let cancelled = false;
    let index = 0;
    let pendingBatchTimer: number | null = null;

    const processBatch = () => {
      pendingBatchTimer = null;
      if (cancelled) {
        return;
      }

      const latestMessages = messagesRef.current;
      const end = Math.min(latestMessages.length, index + DERIVATIVE_BATCH_SIZE);
      for (; index < end; index += 1) {
        getCachedMessageDerivatives(
          stateRef.current.messageCache,
          latestMessages[index]!,
        );
      }

      if (index < latestMessages.length) {
        pendingBatchTimer = window.setTimeout(processBatch, 0);
        return;
      }

      const activeMessageIds = new Set<string>();
      const imageItems: ChatImageGalleryItem[] = [];
      const imageSignatureParts: string[] = [];
      const sentUserItems: string[] = [];
      const sentUserSignatureParts: string[] = [];

      latestMessages.forEach((message) => {
        activeMessageIds.add(message.id);
        const cached = stateRef.current.messageCache.get(message.id);
        if (!cached || cached.message !== message) {
          return;
        }
        const { imageGallery, sentUserMessages } = cached;
        if (imageGallery.signature) {
          imageSignatureParts.push(imageGallery.signature);
          imageItems.push(...imageGallery.items);
        }
        if (sentUserMessages.signature) {
          sentUserSignatureParts.push(sentUserMessages.signature);
          sentUserItems.push(...sentUserMessages.items);
        }
      });

      stateRef.current.messageCache.forEach((_cached, messageId) => {
        if (!activeMessageIds.has(messageId)) {
          stateRef.current.messageCache.delete(messageId);
        }
      });

      const nextImageGallery = {
        items: imageItems,
        signature: imageSignatureParts.join('\u0001'),
      };
      const nextSentUserMessages = {
        items: sentUserItems,
        signature: sentUserSignatureParts.join('\u0001'),
      };
      const imageChanged = nextImageGallery.signature !== stateRef.current.imageGallery.signature;
      const sentChanged = nextSentUserMessages.signature !== stateRef.current.sentUserMessages.signature;

      if (imageChanged) {
        stateRef.current.imageGallery = nextImageGallery;
      }
      if (sentChanged) {
        stateRef.current.sentUserMessages = nextSentUserMessages;
      }
      if (imageChanged || sentChanged) {
        bumpRevision((revision) => revision + 1);
      }
    };

    processBatch();
    return () => {
      cancelled = true;
      if (pendingBatchTimer !== null) {
        window.clearTimeout(pendingBatchTimer);
        pendingBatchTimer = null;
      }
    };
  }, [messages]);

  return {
    imageGallery: stateRef.current.imageGallery.items,
    sentUserMessages: stateRef.current.sentUserMessages.items,
  };
}
