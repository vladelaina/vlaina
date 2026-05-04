import { describe, expect, it } from 'vitest';
import {
  isSupportedVideoUrl,
  normalizeVideoUrlInput,
  parseVideoUrl,
  sanitizeVideoDebugPayload,
} from './index';

describe('videoPlugin URL support', () => {
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
});
