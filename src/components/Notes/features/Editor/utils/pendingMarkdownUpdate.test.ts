import { describe, expect, it } from 'vitest';
import { resolvePendingMarkdownUpdate } from './pendingMarkdownUpdate';

describe('resolvePendingMarkdownUpdate', () => {
  it('replaces a stale markdown listener snapshot with the live editor doc', () => {
    const currentWithMetadata = [
      '---',
      'vlaina_cover: "@biva/2"',
      'vlaina_updated: "2026-05-06T08:40:49.601Z"',
      '---',
      '# 官网测试',
      '### strip',
      '',
      'dfdsfd',
      '',
      'r',
    ].join('\n');
    const stalePending = currentWithMetadata;
    const liveSerializedMarkdown = [
      '# 官网测试',
      '',
      '### strip',
      '',
      'dfdsfd',
      '',
      '<br />',
      '',
      'rtgyhui',
      '',
    ].join('\n');

    expect(
      resolvePendingMarkdownUpdate({
        pendingMarkdown: stalePending,
        latestNoteContent: currentWithMetadata,
        liveSerializedMarkdown,
      }),
    ).toEqual({
      markdownToApply: [
        '---',
        'vlaina_cover: "@biva/2"',
        'vlaina_updated: "2026-05-06T08:40:49.601Z"',
        '---',
        '# 官网测试',
        '### strip',
        '',
        'dfdsfd',
        '',
        '',
        'rtgyhui',
        '',
      ].join('\n'),
      source: 'live-editor',
      liveMarkdown: [
        '---',
        'vlaina_cover: "@biva/2"',
        'vlaina_updated: "2026-05-06T08:40:49.601Z"',
        '---',
        '# 官网测试',
        '### strip',
        '',
        'dfdsfd',
        '',
        '',
        'rtgyhui',
        '',
      ].join('\n'),
    });
  });

  it('allows the pending markdown when it matches the live editor doc after normalization', () => {
    const latestNoteContent = [
      '---',
      'vlaina_icon: "🫧"',
      'vlaina_updated: "2026-05-06T08:40:49.601Z"',
      '---',
      '# 官网测试',
      '### strip',
      '',
      'dfdsfd',
      '',
      '',
      'rtgyhui',
      '',
    ].join('\n');
    const liveSerializedMarkdown = [
      '# 官网测试',
      '',
      '### strip',
      '',
      'dfdsfd',
      '',
      '<br />',
      '',
      'rtgyhui',
      '',
    ].join('\n');

    expect(
      resolvePendingMarkdownUpdate({
        pendingMarkdown: latestNoteContent,
        latestNoteContent,
        liveSerializedMarkdown,
      }),
    ).toEqual({
      markdownToApply: latestNoteContent,
      source: 'pending-markdown',
      liveMarkdown: latestNoteContent,
    });
  });

  it('uses live normalized markdown for custom syntax before saving', () => {
    const latestNoteContent = [
      '---',
      'vlaina_cover: "@biva/2"',
      '---',
      'old body',
    ].join('\n');
    const liveSerializedMarkdown = [
      '\\==highlight==',
      '',
      '\\*[ABBR]: Full phrase',
      '',
      '[^1]: <br />',
      '',
      '| A | B |',
      '| - | - |',
      '| <br /> | <br /> |',
    ].join('\n');

    const expected = [
      '---',
      'vlaina_cover: "@biva/2"',
      '---',
      '==highlight==',
      '',
      '*[ABBR]: Full phrase',
      '',
      '[^1]:',
      '',
      '| A | B |',
      '| - | - |',
      '|   |   |',
    ].join('\n');

    expect(
      resolvePendingMarkdownUpdate({
        pendingMarkdown: latestNoteContent,
        latestNoteContent,
        liveSerializedMarkdown,
      }),
    ).toEqual({
      markdownToApply: expected,
      source: 'live-editor',
      liveMarkdown: expected,
    });
  });
});
