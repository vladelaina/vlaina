import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convertToBase64 } from '@/lib/storage/attachmentStorage';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { buildMessageImageSources, buildStoredUserMessageContent } from './helpers';

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
    useNotesStore.setState({ notesPath: '/vault' });
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

  it('uses a fallback attachment name for oversized relative image sources', async () => {
    const longImageSource = `images/${'a'.repeat(3000)}.png`;
    const content = [
      `![local](${longImageSource})`,
      '',
      'Describe this.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toEqual([
      { type: 'text', text: 'Describe this.' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,REMOTE' } },
    ]);
    expect(convertToBase64).toHaveBeenCalledWith(expect.objectContaining({
      assetUrl: longImageSource,
      name: 'image-1.png',
      previewUrl: longImageSource,
      type: 'image/png',
    }), expect.any(Object));
  });

  it('bounds stored user message image token collection', async () => {
    const content = Array.from({ length: 2001 }, (_, index) => {
      return `![image ${index}](data:image/png;base64,QUJD)`;
    }).join('\n');

    const result = await buildStoredUserMessageContent(content);

    expect(Array.isArray(result) ? result.filter((part) => part.type === 'image_url') : []).toHaveLength(2000);
    expect(JSON.stringify(result)).toContain('![image 2000](data:image/png;base64,QUJD)');
  });

  it('converts vault image attachment paths instead of storing them as managed attachment references', async () => {
    const result = await buildMessageImageSources([{
      id: 'vault-image',
      path: '/vault/assets/cover.png',
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
      path: '/vault/assets/cover.png',
    }), expect.any(Object));
    const options = mocks.convertToBase64.mock.calls[0]?.[1] as
      | { allowPath?: (path: string) => boolean }
      | undefined;
    expect(options?.allowPath?.('/vault/assets/cover.png')).toBe(true);
    expect(options?.allowPath?.('/vault/.notes/cover.png')).toBe(true);
    expect(options?.allowPath?.('/vault/.vlaina/cover.png')).toBe(false);
    expect(options?.allowPath?.('/vault/docs/.git/cover.png')).toBe(false);
    expect(options?.allowPath?.('/outside/cover.png')).toBe(false);
  });

  it('keeps managed attachment URLs as stored references when building message images', async () => {
    const result = await buildMessageImageSources([{
      id: 'stored-image',
      path: '',
      previewUrl: '',
      assetUrl: 'file:///appdata/.vlaina/attachments/demo%20image.png',
      name: 'demo image.png',
      type: 'image/png',
      size: 128,
    }]);

    expect(result).toEqual({
      content: '![image](<attachment://demo%20image.png>)',
      imageSources: ['attachment://demo%20image.png'],
    });
    expect(convertToBase64).not.toHaveBeenCalled();
  });
});
