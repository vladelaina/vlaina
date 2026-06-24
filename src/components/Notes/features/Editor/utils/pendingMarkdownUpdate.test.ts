import { describe, expect, it } from 'vitest';
import { resolvePendingMarkdownUpdate, serializeEditorMarkdownSnapshot } from './pendingMarkdownUpdate';

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
      'rtgyhui',
    ].join('\n');

    const expected = [
      '---',
      'vlaina_cover: "@biva/2"',
      '---',
      '# 官网测试',
      '',
      '### strip',
      '',
      'dfdsfd',
      'rtgyhui',
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
      'rtgyhui',
    ].join('\n');

    const expected = [
      '---',
      'vlaina_icon: "🫧"',
      '---',
      '# 官网测试',
      '',
      '### strip',
      '',
      'dfdsfd',
      'rtgyhui',
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

  it('normalizes live editor serialization before it reaches note state', () => {
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
      '\\*[ABBR]: Full phrase',
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

  it('strips the automatic trailing newline from editor serialization', () => {
    expect(serializeEditorMarkdownSnapshot('1\n\n2\n', '1')).toBe('1\n2');
  });

  it('keeps one trailing newline for an editor-created terminal empty paragraph', () => {
    expect(serializeEditorMarkdownSnapshot('1\n\n2\n\n', '1')).toBe('1\n2\n');
  });

  it('preserves an explicit markdown blank line placeholder while compacting editor paragraph separators', () => {
    expect(
      serializeEditorMarkdownSnapshot(
        [
          '1',
          '',
          '<!--vlaina-markdown-blank-line-->',
          '2',
          '',
          '3',
          '',
        ].join('\n'),
        '1',
      ),
    ).toBe(['1', '', '2', '3'].join('\n'));
  });

  it('strips rendered HTML boundary helpers around one-line HTML image blocks before note state', () => {
    expect(
      serializeEditorMarkdownSnapshot(
        [
          '<img src="./assets/demo.svg" alt="Demo" />',
          '',
          '<!--vlaina-rendered-html-boundary-blank-line-->',
          'After image.',
          '',
        ].join('\n'),
        '<img src="./assets/demo.svg" alt="Demo" />',
      ),
    ).toBe([
      '<img src="./assets/demo.svg" alt="Demo" />',
      '',
      'After image.',
    ].join('\n'));
  });

  it('normalizes leaked editor artifact comments out of display math before note state', () => {
    expect(
      serializeEditorMarkdownSnapshot(
        [
          '$$',
          '<!--vlaina-markdown-blank-line-->',
          'hi',
          '<!--vlaina-rendered-html-boundary-blank-line-->',
          '<!--vlaina-markdown-tight-heading-->',
          '$$',
          '',
        ].join('\n'),
        '',
      ),
    ).toBe(['$$', 'hi', '$$'].join('\n'));
  });

  it('does not persist known editor-only markers from snapshot output', () => {
    const result = serializeEditorMarkdownSnapshot(
      [
        'Before',
        '<!--vlaina-markdown-blank-line-->',
        '<br data-vlaina-empty-line="true" />',
        '��VLAINA_LIST_GAP_SENTINEL��',
        '<br data-vlaina-user-br="true" />',
        '��VLAINA_USER_BR_SENTINEL��',
        '\u200B',
        '\u200B\u200C',
        '\u2800',
        'After',
        '',
      ].join('\n'),
      '',
    );

    expect(result).not.toMatch(
      /vlaina-markdown-|vlaina-rendered-html-boundary|data-vlaina|VLAINA_|\u200B|\u200C|\u2800|�/i,
    );
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });

  it('preserves user-authored rendered HTML boundary comments outside helper positions', () => {
    expect(
      serializeEditorMarkdownSnapshot(
        [
          'Before',
          '',
          '<!--vlaina-rendered-html-boundary-blank-line-->',
          'After',
          '',
        ].join('\n'),
        'Before',
      ),
    ).toBe([
      'Before',
      '',
      '<!--vlaina-rendered-html-boundary-blank-line-->',
      'After',
    ].join('\n'));
  });

  it('preserves editor-created empty paragraphs without keeping serializer separator blanks', () => {
    expect(
      serializeEditorMarkdownSnapshot(
        [
          '1',
          '',
          '<br />',
          '',
          '2',
          '',
        ].join('\n'),
        '1',
      ),
    ).toBe(['1', '', '2'].join('\n'));
  });

  it('preserves multiple editor-created empty paragraphs without extra separator blanks', () => {
    expect(
      serializeEditorMarkdownSnapshot(
        [
          '1',
          '',
          '<br />',
          '',
          '<br />',
          '',
          '2',
          '',
        ].join('\n'),
        '1',
      ),
    ).toBe(['1', '', '', '2'].join('\n'));
  });

  it('preserves reference-authored blank line gaps around inserted text', () => {
    const referenceMarkdown = [
      '---',
      'vlaina_icon: value="hero"',
      '---',
      '1',
      '',
      '2',
    ].join('\n');

    expect(
      serializeEditorMarkdownSnapshot(
        [
          '1',
          '',
          'hi',
          '',
          '2',
          '',
        ].join('\n'),
        referenceMarkdown,
      ),
    ).toBe([
      '---',
      'vlaina_icon: value="hero"',
      '---',
      '1',
      '',
      'hi',
      '',
      '2',
    ].join('\n'));
  });

  it('keeps Shift+Enter hard breaks as markdown hard breaks', () => {
    expect(serializeEditorMarkdownSnapshot('1\\\n2\n', '1')).toBe('1\\\n2');
  });

  it('does not compact structural markdown blank lines', () => {
    expect(
      serializeEditorMarkdownSnapshot(
        [
          'Intro',
          '',
          '- one',
          '- two',
          '',
          '| A | B |',
          '| - | - |',
          '| 1 | 2 |',
          '',
        ].join('\n'),
        'Intro',
      ),
    ).toBe([
      'Intro',
      '',
      '- one',
      '- two',
      '',
      '| A | B |',
      '| - | - |',
      '| 1 | 2 |',
    ].join('\n'));
  });

  it('strips editor-only blank line comments and serializer space entities before note state', () => {
    const latestNoteContent = [
      '---',
      'vlaina_cover: "@biva/2"',
      '---',
      'old body',
    ].join('\n');
    const liveSerializedMarkdown = [
      '# Alpha',
      '<!--vlaina-markdown-blank-line-->',
      '&#x20; Pro:   \\$76.80 / year',
      '&#32 Max:   \\$191.90 / year',
    ].join('\n');

    const expected = [
      '---',
      'vlaina_cover: "@biva/2"',
      '---',
      '# Alpha',
      '',
      '  Pro:   \\$76.80 / year\\',
      ' Max:   \\$191.90 / year',
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
