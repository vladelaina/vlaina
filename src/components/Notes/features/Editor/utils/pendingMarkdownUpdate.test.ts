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

    const expected = [
      '---',
      'vlaina_cover: "@biva/2"',
      'vlaina_updated: "2026-05-06T08:40:49.601Z"',
      '---',
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
      markdownToApply: expected,
      source: 'live-editor',
      liveMarkdown: expected,
    });
  });

  it('uses the live editor doc when pending still equals the latest note content', () => {
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

    const expected = [
      '---',
      'vlaina_icon: "🫧"',
      'vlaina_updated: "2026-05-06T08:40:49.601Z"',
      '---',
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
      markdownToApply: expected,
      source: 'live-editor',
      liveMarkdown: expected,
    });
  });

  it('keeps live editor serialization exact and leaves save-time cleanup to persistence', () => {
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

  it('keeps a real pending edit instead of replacing it with a stale live serialization', () => {
    const latestNoteContent = [
      '8. before',
      '10. after',
    ].join('\n');
    const pendingMarkdown = [
      '8. before',
      '9. <br />',
      '<br />',
      '10. after',
    ].join('\n');
    const liveSerializedMarkdown = latestNoteContent;

    expect(
      resolvePendingMarkdownUpdate({
        pendingMarkdown,
        latestNoteContent,
        liveSerializedMarkdown,
      }),
    ).toEqual({
      markdownToApply: pendingMarkdown,
      source: 'pending-markdown',
      liveMarkdown: latestNoteContent,
    });
  });

  it('restores bracket math fence style from the latest note when using live editor markdown', () => {
    const latestNoteContent = [
      'Before',
      '',
      '\\[',
      'x^2',
      '\\]',
      '',
      'After',
    ].join('\n');
    const pendingMarkdown = latestNoteContent;
    const liveSerializedMarkdown = [
      'Before',
      '',
      '$$',
      'x^2',
      '$$',
      '',
      'After edited',
    ].join('\n');
    const expected = [
      'Before',
      '',
      '\\[',
      'x^2',
      '\\]',
      '',
      'After edited',
    ].join('\n');

    expect(
      resolvePendingMarkdownUpdate({
        pendingMarkdown,
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
