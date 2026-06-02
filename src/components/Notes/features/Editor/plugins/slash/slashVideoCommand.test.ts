import { describe, expect, it } from 'vitest';
import { shouldSkipResolvedVideoUpdate, updateInsertedVideoNodeSrc } from './slashVideoCommand';

describe('slash video resolved URL updates', () => {
  it('skips resolved Bilibili URLs that only add aid and cid', () => {
    expect(
      shouldSkipResolvedVideoUpdate(
        'https://www.bilibili.com/video/BV17jR5BgEsZ?spm_id_from=333&vd_source=secret',
        'https://player.bilibili.com/player.html?isOutside=true&bvid=BV17jR5BgEsZ&p=1&danmaku=0&autoplay=0&aid=116502715957447&cid=38002428818'
      )
    ).toBe(true);
  });

  it('skips resolved Bilibili URLs that preserve the same page', () => {
    expect(
      shouldSkipResolvedVideoUpdate(
        'https://www.bilibili.com/video/BV17jR5BgEsZ?p=2',
        'https://player.bilibili.com/player.html?isOutside=true&bvid=BV17jR5BgEsZ&p=2&danmaku=0&autoplay=0&aid=116502715957447&cid=38002428818'
      )
    ).toBe(true);
  });

  it('keeps updates for non-equivalent URLs', () => {
    expect(
      shouldSkipResolvedVideoUpdate(
        'https://www.bilibili.com/video/BV17jR5BgEsZ',
        'https://player.bilibili.com/player.html?isOutside=true&bvid=BV1nRRNBpELz&p=1&danmaku=0&autoplay=0&aid=116497733125927&cid=37932895651'
      )
    ).toBe(false);
    expect(
      shouldSkipResolvedVideoUpdate(
        'https://example.com/video.webm',
        'https://example.com/video.mp4'
      )
    ).toBe(false);
  });

  it('does not scan unrelated video nodes when the inserted position is missing', () => {
    const videoType = { name: 'video' };
    const existingVideo = {
      type: videoType,
      attrs: {
        src: 'https://example.com/video.webm',
      },
    };
    const dispatchCalls: unknown[] = [];
    const view = {
      dom: document.createElement('div'),
      state: {
        schema: {
          nodes: {
            video: videoType,
          },
        },
        doc: {
          nodeAt: () => existingVideo,
        },
        tr: {
          setNodeMarkup: () => ({}),
        },
      },
      dispatch: (tr: unknown) => {
        dispatchCalls.push(tr);
      },
    };

    expect(updateInsertedVideoNodeSrc({
      view: view as never,
      insertedPos: null,
      previousSrc: 'https://example.com/video.webm',
      nextSrc: 'https://example.com/video.mp4',
    })).toBe(false);

    expect(dispatchCalls).toEqual([]);
  });
});
