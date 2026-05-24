import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import {
  isSupportedVideoUrl,
  normalizeVideoUrlInput,
  parseVideoUrl,
  sanitizeVideoDebugPayload,
} from './index';
import { createVideoDom } from './videoDom';
import { videoPlugin } from './videoPlugin';

async function serializeVideoNode(src: string, title = '') {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, '');
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark);

  for (const plugin of videoPlugin) {
    editor.use(plugin);
  }

  await editor.create();
  const schema = editor.ctx.get(editorViewCtx).state.schema;
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.video.create({ src, title }),
  ]);
  const markdown = editor.ctx.get(serializerCtx)(doc).trim();
  await editor.destroy();
  return markdown;
}

describe('videoPlugin URL support', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('supports youtube, bilibili, and direct video URLs', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      type: 'youtube',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&playsinline=1&rel=0',
    });
    expect(parseVideoUrl('https://www.youtube.com/watch?si=abc&v=dQw4w9WgXcQ')).toEqual({
      type: 'youtube',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&playsinline=1&rel=0',
    });
    expect(parseVideoUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toEqual({
      type: 'youtube',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&playsinline=1&rel=0',
    });
    expect(parseVideoUrl('https://www.bilibili.com/video/BV1xx411c7mD')).toEqual({
      type: 'bilibili',
      embedUrl: 'https://player.bilibili.com/player.html?isOutside=true&bvid=BV1xx411c7mD&p=1&danmaku=0&autoplay=0',
    });
    expect(parseVideoUrl('https://www.bilibili.com/video/BV1xx411c7mD?p=2')).toEqual({
      type: 'bilibili',
      embedUrl: 'https://player.bilibili.com/player.html?isOutside=true&bvid=BV1xx411c7mD&p=2&danmaku=0&autoplay=0',
    });
    expect(parseVideoUrl('https://player.bilibili.com/player.html?isOutside=true&aid=123&bvid=BV1xx411c7mD&cid=456&p=2')).toEqual({
      type: 'bilibili',
      embedUrl: 'https://player.bilibili.com/player.html?isOutside=true&bvid=BV1xx411c7mD&p=2&danmaku=0&autoplay=0&aid=123&cid=456',
    });
    expect(parseVideoUrl('https://example.com/video.webm?token=1')).toEqual({
      type: 'direct',
      embedUrl: 'https://example.com/video.webm?token=1',
    });
  });

  it('rejects non-video URLs instead of creating a blank embed', () => {
    expect(isSupportedVideoUrl('https://example.com/article')).toBe(false);
  });

  it('rejects local file and private-network direct video URLs', () => {
    expect(parseVideoUrl('file:///tmp/secret.mp4')).toBeNull();
    expect(parseVideoUrl('data:video/mp4;base64,AAAA')).toBeNull();
    expect(parseVideoUrl('http://localhost:3000/secret.mp4')).toBeNull();
    expect(parseVideoUrl('http://127.0.0.1:3000/secret.mp4')).toBeNull();
    expect(parseVideoUrl('http://192.168.1.8/secret.mp4')).toBeNull();
    expect(parseVideoUrl('http://10.0.0.5/secret.webm')).toBeNull();
    expect(parseVideoUrl('http://[::ffff:7f00:1]/secret.webm')).toBeNull();
  });

  it('normalizes pasted URLs and rejects log blobs', () => {
    expect(normalizeVideoUrlInput('  https://www.bilibili.com/video/BV1xx411c7mD  ')).toBe(
      'https://www.bilibili.com/video/BV1xx411c7mD'
    );
    expect(parseVideoUrl('  https://www.youtube.com/watch?v=dQw4w9WgXcQ  ')).toEqual({
      type: 'youtube',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&playsinline=1&rel=0',
    });
    expect(isSupportedVideoUrl('[2026-05-03T12:41:17.327Z] chatScroll:programmatic-scroll {\n  "scrollTop": 1012\n}')).toBe(false);
    expect(isSupportedVideoUrl(`https://example.com/${'a'.repeat(2050)}.mp4`)).toBe(false);
    expect(isSupportedVideoUrl('https://example.com/\u202Ecod.mp4')).toBe(false);
    expect(isSupportedVideoUrl('https://example.com/\u0000video.mp4')).toBe(false);
  });

  it('redacts video URL debug payloads', () => {
    expect(sanitizeVideoDebugPayload({
      url: 'https://www.bilibili.com/video/BV1xx411c7mD?vd_source=secret&spm_id_from=333',
      resolved: {
        resolvedUrl: 'https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&cid=456&token=secret',
      },
    })).toEqual({
      url: {
        value: 'https://www.bilibili.com/video/BV1xx411c7mD?vd_source=%5Bredacted%5D&spm_id_from=%5Bredacted%5D',
        length: 76,
        hasNewline: false,
        truncated: false,
      },
      resolved: {
        resolvedUrl: {
          value: 'https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&cid=456&token=%5Bredacted%5D',
          length: 78,
          hasNewline: false,
          truncated: false,
        },
      },
    });
  });

  it('does not auto-load public remote video embeds when rendering a note', () => {
    const youtube = createVideoDom({
      src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: '',
      width: 560,
      height: 315,
    });
    const direct = createVideoDom({
      src: 'https://example.com/video.mp4',
      title: '',
      width: 560,
      height: 315,
    });

    expect(youtube.querySelector('iframe')).toBeNull();
    expect(youtube.querySelector('video')).toBeNull();
    expect(youtube.textContent).toContain('Remote video blocked');
    expect(direct.querySelector('iframe')).toBeNull();
    expect(direct.querySelector('video')).toBeNull();
    expect(direct.textContent).toContain('Remote video blocked');
  });

  it('does not register global video debug listeners while video debug logging is disabled', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    createVideoDom({
      src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: '',
      width: 560,
      height: 315,
    });

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'securitypolicyviolation',
      expect.any(Function),
    );
    addEventListenerSpy.mockRestore();
  });

  it('serializes supported video nodes as markdown image syntax', async () => {
    await expect(serializeVideoNode(' https://example.com/video.mp4 ', 'Demo video')).resolves.toBe(
      '![video](https://example.com/video.mp4 "Demo video")'
    );
  });

  it('drops unsupported video node URLs during markdown serialization', async () => {
    await expect(serializeVideoNode('javascript:alert(1)')).resolves.toBe('');
    await expect(serializeVideoNode('http://127.0.0.1:3000/secret.mp4')).resolves.toBe('');
    await expect(serializeVideoNode('https://example.com/article')).resolves.toBe('');
  });
});
