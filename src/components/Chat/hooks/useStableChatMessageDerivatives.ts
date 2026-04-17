import { useRef } from 'react';
import type { ChatMessage } from '@/lib/ai/types';
import { extractMessageImageSources } from '@/components/Chat/common/messageClipboard';

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
};

function buildImageGallery(messages: ChatMessage[]): DerivedCollection<ChatImageGalleryItem> {
  const items: ChatImageGalleryItem[] = [];
  const signatureParts: string[] = [];

  messages.forEach((message) => {
    if (message.role !== 'assistant') {
      return;
    }

    const sources = message.imageSources && message.imageSources.length > 0
      ? message.imageSources
      : extractMessageImageSources(message.content || '');

    if (sources.length === 0) {
      return;
    }

    signatureParts.push(`${message.id}\u0000${sources.join('\u0002')}`);
    sources.forEach((src, index) => {
      items.push({
        id: `${message.id}:${index}`,
        src,
      });
    });
  });

  return {
    items,
    signature: signatureParts.join('\u0001'),
  };
}

function buildSentUserMessages(messages: ChatMessage[]): DerivedCollection<string> {
  const items: string[] = [];
  const signatureParts: string[] = [];

  messages.forEach((message) => {
    if (message.role !== 'user') {
      return;
    }

    const content = message.content.trim();
    if (!content) {
      return;
    }

    items.push(message.content);
    signatureParts.push(`${message.id}\u0000${message.currentVersionIndex}\u0000${message.content}`);
  });

  return {
    items,
    signature: signatureParts.join('\u0001'),
  };
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
  });

  const nextImageGallery = buildImageGallery(messages);
  if (nextImageGallery.signature !== stateRef.current.imageGallery.signature) {
    stateRef.current.imageGallery = nextImageGallery;
  }

  const nextSentUserMessages = buildSentUserMessages(messages);
  if (nextSentUserMessages.signature !== stateRef.current.sentUserMessages.signature) {
    stateRef.current.sentUserMessages = nextSentUserMessages;
  }

  return {
    imageGallery: stateRef.current.imageGallery.items,
    sentUserMessages: stateRef.current.sentUserMessages.items,
  };
}
