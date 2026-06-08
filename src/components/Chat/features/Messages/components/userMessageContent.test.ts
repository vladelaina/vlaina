import { describe, expect, it } from 'vitest';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import { MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES } from '@/components/Chat/common/messageClipboard';
import {
  composeUserMessageContent,
  parseUserMessageContent,
  parseUserMessageContentWithKnownImages,
  toEditAttachment,
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

  it('parses raw html images separately from user message text', () => {
    expect(parseUserMessageContent('<img src="https://example.com/photo.png">\n\nhello')).toEqual({
      imageSources: ['https://example.com/photo.png'],
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

  it('parses case-insensitive data image markdown separately from text', () => {
    expect(parseUserMessageContent('![image](<DATA:IMAGE/PNG;BASE64,AAAA>)\n\nhello')).toEqual({
      imageSources: ['data:image/png;base64,AAAA'],
      text: 'hello',
    });
  });

  it('bounds image parsing for image-heavy edited user messages', () => {
    const content = Array.from(
      { length: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES + 1 },
      (_, index) => `![image ${index}](https://example.com/${index}.png)`,
    ).join('\n');

    const parsed = parseUserMessageContent(content);

    expect(parsed.imageSources).toHaveLength(MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES);
    expect(parsed.text).toContain(
      `![image ${MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES}](https://example.com/${MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES}.png)`,
    );
  });

  it('infers edit attachment metadata from case-insensitive data image sources', () => {
    expect(toEditAttachment('DATA:IMAGE/WEBP;BASE64,AAAA', 0)).toMatchObject({
      previewUrl: 'DATA:IMAGE/WEBP;BASE64,AAAA',
      assetUrl: 'DATA:IMAGE/WEBP;BASE64,AAAA',
      name: 'image-1.webp',
      type: 'image/webp',
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

  it('filters known video sources from stored user messages', () => {
    const content = [
      '![video](<https://example.com/movie.mp4>)',
      '',
      '![image](<attachment://safe.png>)',
      '',
      'hello',
    ].join('\n');

    expect(parseUserMessageContentWithKnownImages(content, [
      'https://example.com/movie.mp4',
      'attachment://safe.png',
    ])).toEqual({
      imageSources: ['attachment://safe.png'],
      text: [
        '![video](<https://example.com/movie.mp4>)',
        '',
        '',
        '',
        'hello',
      ].join('\n'),
    });
  });
});
