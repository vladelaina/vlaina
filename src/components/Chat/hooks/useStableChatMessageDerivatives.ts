import { useRef } from 'react';
import type { ChatMessage } from '@/lib/ai/types';
import {
  extractRenderedMessageImageSources,
  isRenderedImageSource,
} from '@/components/Chat/common/messageClipboard';
import { normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';

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

function buildMessageImageGallery(message: ChatMessage): DerivedCollection<ChatImageGalleryItem> {
  if (message.role !== 'assistant') {
    return { items: [], signature: '' };
  }

  const sources = message.imageSources && message.imageSources.length > 0
    ? message.imageSources
    : extractRenderedMessageImageSources(message.content || '');
  const renderableSources = sources
    .map((src) => normalizeRenderableImageSrc(src))
    .filter((src): src is string => !!src && isRenderedImageSource(src));

  if (renderableSources.length === 0) {
    return { items: [], signature: '' };
  }

  return {
    items: renderableSources.map((src, index) => ({
      id: `${message.id}:${index}`,
      src,
    })),
    signature: `${message.id}\u0000${renderableSources.length}\u0000${renderableSources.map((src) => `${src.length}:${hashString(src)}`).join('\u0002')}`,
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
    signature: `${message.id}\u0000${message.currentVersionIndex}\u0000${message.content.length}:${hashString(message.content)}`,
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

  const activeMessageIds = new Set(messages.map((message) => message.id));
  stateRef.current.messageCache.forEach((_cached, messageId) => {
    if (!activeMessageIds.has(messageId)) {
      stateRef.current.messageCache.delete(messageId);
    }
  });

  const messageDerivatives = messages.map((message) =>
    getCachedMessageDerivatives(stateRef.current.messageCache, message)
  );

  const imageItems: ChatImageGalleryItem[] = [];
  const imageSignatureParts: string[] = [];
  messageDerivatives.forEach(({ imageGallery }) => {
    if (imageGallery.signature) {
      imageSignatureParts.push(imageGallery.signature);
      imageItems.push(...imageGallery.items);
    }
  });
  const nextImageGallery = {
    items: imageItems,
    signature: imageSignatureParts.join('\u0001'),
  };
  if (nextImageGallery.signature !== stateRef.current.imageGallery.signature) {
    stateRef.current.imageGallery = nextImageGallery;
  }

  const sentUserItems: string[] = [];
  const sentUserSignatureParts: string[] = [];
  messageDerivatives.forEach(({ sentUserMessages }) => {
    if (sentUserMessages.signature) {
      sentUserSignatureParts.push(sentUserMessages.signature);
      sentUserItems.push(...sentUserMessages.items);
    }
  });
  const nextSentUserMessages = {
    items: sentUserItems,
    signature: sentUserSignatureParts.join('\u0001'),
  };
  if (nextSentUserMessages.signature !== stateRef.current.sentUserMessages.signature) {
    stateRef.current.sentUserMessages = nextSentUserMessages;
  }

  return {
    imageGallery: stateRef.current.imageGallery.items,
    sentUserMessages: stateRef.current.sentUserMessages.items,
  };
}
