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

  it('keeps code example image markdown in user message text', () => {
    const content = [
      '```md',
      '![example](attachment://code.png)',
      '```',
      '',
      '![image](<attachment://real.png>)',
      '',
      'hello',
    ].join('\n');

    expect(parseUserMessageContent(content)).toEqual({
      imageSources: ['attachment://real.png'],
      text: [
        '```md',
        '![example](attachment://code.png)',
        '```',
        '',
        '',
        '',
        'hello',
      ].join('\n'),
    });
  });

  it('keeps inline code image markdown in user message text', () => {
    expect(parseUserMessageContent('Use `![example](attachment://code.png)` here')).toEqual({
      imageSources: [],
      text: 'Use `![example](attachment://code.png)` here',
    });
  });

  it('uses known image sources to avoid reparsing large inline image payloads', () => {
    const source = `data:image/png;base64,${'a'.repeat(60_000)}`;

    expect(parseUserMessageContentWithKnownImages(`![image](<${source}>)\n\nhello`, [source])).toEqual({
      imageSources: [source],
      text: 'hello',
    });
  });

  it('filters unsafe known image sources from stored user messages', () => {
    const content = [
      '![image](<http://127.0.0.1:3000/secret.png>)',
      '',
      '![image](<attachment://safe.png>)',
      '',
      'hello',
    ].join('\n');

    expect(parseUserMessageContentWithKnownImages(content, [
      'http://127.0.0.1:3000/secret.png',
      'attachment://safe.png',
    ])).toEqual({
      imageSources: ['attachment://safe.png'],
      text: [
        '![image](<http://127.0.0.1:3000/secret.png>)',
        '',
        '',
        '',
        'hello',
      ].join('\n'),
    });
  });
});
