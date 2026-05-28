import { describe, expect, it } from 'vitest';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import {
  composeUserMessageContent,
  parseUserMessageContent,
  parseUserMessageContentWithKnownImages,
} from './userMessageContent';

function createAttachment(overrides: Partial<Attachment>): Attachment {
  return {
    id: 'attachment-1',
    path: '',
    previewUrl: '',
    assetUrl: '',
    name: 'image.png',
    type: 'image/png',
    size: 0,
    ...overrides,
  };
}

describe('userMessageContent', () => {
  it('keeps in-memory temporary images when composing edited user messages', () => {
    const content = composeUserMessageContent('hello', [
      createAttachment({
        previewUrl: 'data:image/png;base64,INLINE',
        assetUrl: '',
      }),
    ]);

    expect(content).toBe('![image](<data:image/png;base64,INLINE>)\n\nhello');
  });

  it('prefers persisted asset URLs when available', () => {
    const content = composeUserMessageContent('hello', [
      createAttachment({
        previewUrl: 'data:image/png;base64,INLINE',
        assetUrl: 'attachment://persisted.png',
      }),
    ]);

    expect(content).toBe('![image](<attachment://persisted.png>)\n\nhello');
  });

  it('parses image markdown separately from text', () => {
    expect(parseUserMessageContent('![image](<attachment://demo.png>)\n\nhello')).toEqual({
      imageSources: ['attachment://demo.png'],
      text: 'hello',
    });
  });

  it('uses known image sources to avoid reparsing large inline image payloads', () => {
    const source = `data:image/png;base64,${'a'.repeat(60_000)}`;

    expect(parseUserMessageContentWithKnownImages(`![image](<${source}>)\n\nhello`, [source])).toEqual({
      imageSources: [source],
      text: 'hello',
    });
  });
});
