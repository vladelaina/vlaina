import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_INLINE_IMAGE_BYTES } from '@/lib/markdown/dataImagePolicy';
import { convertToBase64 } from '@/lib/storage/attachmentStorage';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import {
  buildMessageImageSources,
  buildStoredUserMessageContent,
  getAttachmentMessageImageSrc,
  isImageAttachment,
  MAX_CHAT_MESSAGE_IMAGE_ATTACHMENTS,
} from './helpers';

const mocks = vi.hoisted(() => ({
  convertToBase64: vi.fn(),
}));

vi.mock('@/lib/storage/attachmentStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage/attachmentStorage')>();
  return {
    ...actual,
    convertToBase64: mocks.convertToBase64,
  };
});

describe('buildStoredUserMessageContent image parsing', () => {
  beforeEach(() => {
    mocks.convertToBase64.mockReset();
    mocks.convertToBase64.mockResolvedValue('data:image/png;base64,REMOTE');
    useNotesStore.setState({ notesPath: '/notesRoot', starredEntries: [] });
  });

  it('keeps image markdown examples as text instead of vision attachments', async () => {
    const content = [
      'Use this syntax:',
      '```md',
      '![example](data:image/png;base64,CODE)',
      '```',
      '',
      '![image](<data:image/png;base64,REAL>)',
      '',
      'Describe the real image.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toEqual([
      {
        type: 'text',
        text: [
          'Use this syntax:',
          '```md',
          '![example](data:image/png;base64,CODE)',
          '```',
          '',
          '',
          '',
          'Describe the real image.',
        ].join('\n'),
      },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,REAL' } },
    ]);
  });

  it('keeps inline code image markdown as text', async () => {
    await expect(buildStoredUserMessageContent('Use `![example](data:image/png;base64,CODE)` here')).resolves.toBe(
      'Use `![example](data:image/png;base64,CODE)` here',
    );
  });

  it('ignores non-string attachment image fields without coercion', () => {
    const field = {
      toString() {
        throw new Error('attachment field coercion');
      },
    };
    const attachment = {
      id: 'bad',
      path: field,
      previewUrl: field,
      assetUrl: field,
      name: field,
      type: field,
      size: 0,
    } as any;

    expect(isImageAttachment(attachment)).toBe(false);
    expect(getAttachmentMessageImageSrc(attachment)).toBe('');
  });

  it('keeps safe remote markdown images as vision attachments on resend paths', async () => {
    const content = [
      '![remote](https://example.com/photo.png)',
      '',
      'Describe the real image.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toEqual([
      {
        type: 'text',
        text: 'Describe the real image.',
      },
      { type: 'image_url', image_url: { url: 'https://example.com/photo.png' } },
    ]);
  });

  it('does not turn video markdown into vision attachments on resend paths', async () => {
    const content = [
      '![video](https://example.com/movie.mp4)',
      '',
      'Describe this.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toBe(content);
  });

  it('keeps unsafe image markdown as text instead of vision attachments', async () => {
    const content = [
      '![local](http://127.0.0.1:3000/secret.png)',
      '',
      '![safe](<data:image/png;base64,REAL>)',
      '',
      'Describe the real image.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toEqual([
      {
        type: 'text',
        text: [
          '![local](http://127.0.0.1:3000/secret.png)',
          '',
          '',
          '',
          'Describe the real image.',
        ].join('\n'),
      },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,REAL' } },
    ]);
  });

  it('converts rendered raw HTML image sources into vision message parts on resend paths', async () => {
    const content = [
      '<img src="https://example.com/photo.png" alt="photo">',
      '',
      '<img src="data:image/png;base64,REAL" alt="inline">',
      '',
      'Describe these images.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toEqual([
      {
        type: 'text',
        text: 'Describe these images.',
      },
      { type: 'image_url', image_url: { url: 'https://example.com/photo.png' } },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,REAL' } },
    ]);
  });

  it('scrubs skipped oversized raw HTML data images on resend paths', async () => {
    const content = [
      `<img alt="${'a'.repeat(70_000)}" src="data:image/png;base64,SECRET">`,
      'Describe this.',
    ].join('\n');

    const result = await buildStoredUserMessageContent(content);

    expect(result).toEqual([{ type: 'text', text: 'Describe this.' }]);
    expect(JSON.stringify(result)).not.toContain('data:image/png;base64,SECRET');
    expect(JSON.stringify(result)).not.toContain('<img');
  });

  it('does not convert raw HTML images inside sanitizer-dropped containers on resend paths', async () => {
    const content = [
      '<svg><img src="https://example.com/hidden.png"></svg>',
      '<noscript><img src="https://example.com/noscript.png"></noscript>',
      '<img src="https://example.com/real.png" alt="real">',
      '',
      'Describe this image.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toEqual([
      {
        type: 'text',
        text: [
          '<svg><img src="https://example.com/hidden.png"></svg>',
          '<noscript><img src="https://example.com/noscript.png"></noscript>',
          '',
          '',
          'Describe this image.',
        ].join('\n'),
      },
      { type: 'image_url', image_url: { url: 'https://example.com/real.png' } },
    ]);
  });

  it('keeps relative directory image sources as text instead of vision attachments', async () => {
    const content = [
      '![local](images/demo.png)',
      '',
      'Describe this.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toBe(content);
    expect(convertToBase64).not.toHaveBeenCalled();
  });

  it('keeps bare image filenames as text instead of stored vision attachments', async () => {
    const content = [
      '![bare](demo.png)',
      '',
      'Describe this.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toBe(content);
    expect(convertToBase64).not.toHaveBeenCalled();
  });

  it('converts stored attachment image references into vision attachments on resend paths', async () => {
    const content = [
      '![stored](<attachment://demo%20image.png>)',
      '',
      'Describe this.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toEqual([
      { type: 'text', text: 'Describe this.' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,REMOTE' } },
    ]);
    expect(convertToBase64).toHaveBeenCalledWith(expect.objectContaining({
      assetUrl: 'attachment://demo%20image.png',
      name: 'demo image.png',
      previewUrl: 'attachment://demo%20image.png',
      type: 'image/png',
    }), expect.any(Object));
  });

  it('bounds stored user message image token collection', async () => {
    const content = Array.from({ length: 2001 }, (_, index) => {
      return `![image ${index}](data:image/png;base64,QUJD)`;
    }).join('\n');

    const result = await buildStoredUserMessageContent(content);

    expect(Array.isArray(result) ? result.filter((part) => part.type === 'image_url') : []).toHaveLength(
      MAX_CHAT_MESSAGE_IMAGE_ATTACHMENTS,
    );
    expect(JSON.stringify(result)).not.toContain('![image 2000]');
    expect(JSON.stringify(result)).not.toContain('data:image/png;base64,QUJD)');
  });

  it('scrubs skipped oversized data images after parsed image tokens', async () => {
    const oversizedSource = `data:image/png;base64,${'A'.repeat(1024 * 1024 + 16)}`;
    const content = [
      '![image](<data:image/png;base64,REAL>)',
      `![huge](<${oversizedSource}>)`,
      'Describe this.',
    ].join('\n');

    const result = await buildStoredUserMessageContent(content);

    expect(result).toEqual([
      { type: 'text', text: 'Describe this.' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,REAL' } },
    ]);
    expect(JSON.stringify(result)).not.toContain('data:image/png;base64,A');
  });

  it('scrubs skipped entity-encoded oversized data images after parsed image tokens', async () => {
    const oversizedSource = `data&colon;image&sol;png&semi;base64&comma;${'A'.repeat(1024 * 1024 + 16)}`;
    const content = [
      '![image](<data:image/png;base64,REAL>)',
      `![huge](<${oversizedSource}>)`,
      'Describe this.',
    ].join('\n');

    const result = await buildStoredUserMessageContent(content);

    expect(result).toEqual([
      { type: 'text', text: 'Describe this.' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,REAL' } },
    ]);
    expect(JSON.stringify(result)).not.toContain('data&colon;image&sol;');
    expect(JSON.stringify(result)).not.toContain('&semi;base64&comma;');
  });

  it('scrubs skipped escaped-scheme oversized data images after parsed image tokens', async () => {
    const oversizedSource = String.raw`data\:image/png;base64,${'A'.repeat(1024 * 1024 + 16)}`;
    const content = [
      '![image](<data:image/png;base64,REAL>)',
      `![huge](<${oversizedSource}>)`,
      'Describe this.',
    ].join('\n');

    const result = await buildStoredUserMessageContent(content);

    expect(result).toEqual([
      { type: 'text', text: 'Describe this.' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,REAL' } },
    ]);
    expect(JSON.stringify(result)).not.toContain(String.raw`data\:image/`);
  });

  it('converts notesRoot image attachment paths instead of storing them as managed attachment references', async () => {
    const result = await buildMessageImageSources([{
      id: 'notes-root-image',
      path: '/notesRoot/assets/cover.png',
      previewUrl: '',
      assetUrl: '',
      name: 'cover.png',
      type: 'image/png',
      size: 128,
    }]);

    expect(result).toEqual({
      content: '![image](<data:image/png;base64,REMOTE>)',
      imageSources: ['data:image/png;base64,REMOTE'],
    });
    expect(convertToBase64).toHaveBeenCalledWith(expect.objectContaining({
      path: '/notesRoot/assets/cover.png',
    }), expect.any(Object));
    const options = mocks.convertToBase64.mock.calls[0]?.[1] as
      | { allowPath?: (path: string) => boolean }
      | undefined;
    expect(options?.allowPath?.('/notesRoot/assets/cover.png')).toBe(true);
    expect(options?.allowPath?.('/notesRoot/.notes/cover.png')).toBe(true);
    expect(options?.allowPath?.('/notesRoot/.vlaina/cover.png')).toBe(false);
    expect(options?.allowPath?.('/notesRoot/docs/.git/cover.png')).toBe(false);
    expect(options?.allowPath?.('/notesRoot/.VLAINA/cover.png')).toBe(false);
    expect(options?.allowPath?.('/notesRoot/docs/.GIT/cover.png')).toBe(false);
    expect(options?.allowPath?.('/outside/cover.png')).toBe(false);
  });

  it('allows image attachment paths from starred external folders', async () => {
    useNotesStore.setState({
      notesPath: '/notesRoot',
      starredEntries: [
        {
          id: 'external-assets',
          kind: 'folder',
          notesRootPath: '/external',
          relativePath: 'assets',
          addedAt: 1,
        },
      ],
    });

    await buildMessageImageSources([{
      id: 'external-image',
      path: '/external/assets/cover.png',
      previewUrl: '',
      assetUrl: '',
      name: 'cover.png',
      type: 'image/png',
      size: 128,
    }]);

    const options = mocks.convertToBase64.mock.calls[0]?.[1] as
      | { allowPath?: (path: string) => boolean }
      | undefined;
    expect(options?.allowPath?.('/external/assets/cover.png')).toBe(true);
    expect(options?.allowPath?.('/external/assets/nested/cover.png')).toBe(true);
    expect(options?.allowPath?.('/external/other/cover.png')).toBe(false);
    expect(options?.allowPath?.('/external/assets/.vlaina/cover.png')).toBe(false);
    expect(options?.allowPath?.('/outside/cover.png')).toBe(false);
  });

  it('allows starred external folder image paths rooted at filesystem roots', async () => {
    useNotesStore.setState({
      notesPath: '/notesRoot',
      starredEntries: [
        {
          id: 'root-assets',
          kind: 'folder',
          notesRootPath: '/',
          relativePath: 'assets',
          addedAt: 1,
        },
        {
          id: 'drive-assets',
          kind: 'folder',
          notesRootPath: 'C:/',
          relativePath: 'Assets',
          addedAt: 2,
        },
      ],
    });

    await buildMessageImageSources([{
      id: 'external-image',
      path: '/assets/cover.png',
      previewUrl: '',
      assetUrl: '',
      name: 'cover.png',
      type: 'image/png',
      size: 128,
    }]);

    const options = mocks.convertToBase64.mock.calls[0]?.[1] as
      | { allowPath?: (path: string) => boolean }
      | undefined;
    expect(options?.allowPath?.('/assets/cover.png')).toBe(true);
    expect(options?.allowPath?.('/other/cover.png')).toBe(false);
    expect(options?.allowPath?.('C:/Assets/cover.png')).toBe(true);
    expect(options?.allowPath?.('C:/Other/cover.png')).toBe(false);
  });

  it('rejects image attachment paths from unsafe starred external folder records', async () => {
    useNotesStore.setState({
      notesPath: '/notesRoot',
      starredEntries: [
        {
          id: 'unsafe-notesRoot',
          kind: 'folder',
          notesRootPath: '/external\u202Ecod',
          relativePath: 'assets',
          addedAt: 1,
        },
        {
          id: 'traversal-relative',
          kind: 'folder',
          notesRootPath: '/external',
          relativePath: '../assets',
          addedAt: 1,
        },
      ],
    });

    await buildMessageImageSources([{
      id: 'external-image',
      path: '/external/assets/cover.png',
      previewUrl: '',
      assetUrl: '',
      name: 'cover.png',
      type: 'image/png',
      size: 128,
    }]);

    const options = mocks.convertToBase64.mock.calls[0]?.[1] as
      | { allowPath?: (path: string) => boolean }
      | undefined;
    expect(options?.allowPath?.('/external\u202Ecod/assets/cover.png')).toBe(false);
    expect(options?.allowPath?.('/external/assets/cover.png')).toBe(false);
  });

  it('rejects image attachment paths from starred folders rooted in internal note directories', async () => {
    useNotesStore.setState({
      notesPath: '/notesRoot',
      starredEntries: [
        {
          id: 'internal-assets',
          kind: 'folder',
          notesRootPath: '/external/.vlaina',
          relativePath: 'assets',
          addedAt: 1,
        },
        {
          id: 'git-assets',
          kind: 'folder',
          notesRootPath: '/external/docs/.git',
          relativePath: 'assets',
          addedAt: 1,
        },
      ],
    });

    await buildMessageImageSources([{
      id: 'external-image',
      path: '/external/.vlaina/assets/cover.png',
      previewUrl: '',
      assetUrl: '',
      name: 'cover.png',
      type: 'image/png',
      size: 128,
    }]);

    const options = mocks.convertToBase64.mock.calls[0]?.[1] as
      | { allowPath?: (path: string) => boolean }
      | undefined;
    expect(options?.allowPath?.('/external/.vlaina/assets/cover.png')).toBe(false);
    expect(options?.allowPath?.('/external/docs/.git/assets/cover.png')).toBe(false);
  });

  it('does not resolve file attachment asset URLs without a trusted attachment path', async () => {
    const result = await buildMessageImageSources([{
      id: 'stored-image',
      path: '',
      previewUrl: '',
      assetUrl: 'file:///appdata/.vlaina/chat/attachments/demo%20image.png',
      name: 'demo image.png',
      type: 'image/png',
      size: 128,
    }]);

    expect(result).toEqual({ content: '', imageSources: [] });
    expect(convertToBase64).not.toHaveBeenCalled();
  });

  it('stops rebuilding stored message image parts before the total source budget is exceeded', async () => {
    const largePayload = 'A'.repeat(Math.floor((MAX_INLINE_IMAGE_BYTES - 3) / 3) * 4);
    mocks.convertToBase64.mockResolvedValue(`data:image/png;base64,${largePayload}`);
    const content = [
      '![first](<attachment://first.png>)',
      '![second](<attachment://second.png>)',
      '![third](<attachment://third.png>)',
      'Describe these.',
    ].join('\n\n');

    const result = await buildStoredUserMessageContent(content);
    const parts = Array.isArray(result) ? result : [];

    expect(parts.filter((part) => part.type === 'image_url')).toHaveLength(2);
    expect(JSON.stringify(result)).toContain('Describe these.');
    expect(convertToBase64).toHaveBeenCalledTimes(3);
  });

  it('stops building attachment image sources before the total source budget is exceeded', async () => {
    const largePayload = 'A'.repeat(Math.floor((MAX_INLINE_IMAGE_BYTES - 3) / 3) * 4);
    mocks.convertToBase64.mockResolvedValue(`data:image/png;base64,${largePayload}`);

    const attachments = Array.from({ length: 4 }, (_value, index) => ({
      id: `large-${index}`,
      path: `/notesRoot/assets/large-${index}.png`,
      previewUrl: '',
      assetUrl: '',
      name: `large-${index}.png`,
      type: 'image/png',
      size: MAX_INLINE_IMAGE_BYTES - 3,
    }));

    const result = await buildMessageImageSources(attachments);

    expect(result.imageSources).toHaveLength(2);
    expect(result.content.match(/!\[image\]/g)).toHaveLength(2);
    expect(convertToBase64).toHaveBeenCalledTimes(3);
  });
});
