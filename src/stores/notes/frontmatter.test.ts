import { describe, expect, it } from 'vitest';
import {
  readNoteMetadataFromMarkdown,
  stripUpdatedFrontmatter,
  stripManagedFrontmatter,
  updateNoteMetadataInMarkdown,
  writeNoteMetadataToMarkdown,
} from './frontmatter';

describe('note frontmatter metadata', () => {
  it('reads managed note metadata from leading yaml frontmatter', () => {
    const markdown = [
      '---',
      'vlaina_cover: "assets/monet.jpg"',
      'vlaina_cover_x: 40',
      'vlaina_cover_y: 60',
      'vlaina_cover_height: 220',
      'vlaina_cover_scale: 1.3',
      'vlaina_icon: "🐱"',
      'vlaina_created: "2026-04-15T01:02:03.000Z"',
      'vlaina_updated: "2026-04-16T01:02:03.000Z"',
      '---',
      '',
      '# Title',
    ].join('\n');

    expect(readNoteMetadataFromMarkdown(markdown)).toEqual({
      cover: {
        assetPath: 'assets/monet.jpg',
        positionX: 40,
        positionY: 60,
        height: 220,
        scale: 1.3,
      },
      icon: '🐱',
      createdAt: Date.parse('2026-04-15T01:02:03.000Z'),
      updatedAt: Date.parse('2026-04-16T01:02:03.000Z'),
    });
  });

  it('preserves user frontmatter and appends managed fields at the bottom', () => {
    const markdown = [
      '---',
      'title: Example',
      'aliases: ["demo"]',
      'icon: "old"',
      '---',
      '',
      '# Title',
    ].join('\n');

    expect(
      writeNoteMetadataToMarkdown(markdown, {
        icon: '🐱',
        updatedAt: Date.parse('2026-04-16T00:00:00.000Z'),
      })
    ).toBe(
      [
        '---',
        'title: Example',
        'aliases: ["demo"]',
        'icon: "old"',
        '',
        'vlaina_icon: "🐱"',
        'vlaina_updated: 2026-04-16 08:00:00 +08:00',
        '---',
        '',
        '# Title',
      ].join('\n')
    );
  });

  it('clamps managed cover numbers from untrusted frontmatter', () => {
    const markdown = [
      '---',
      'vlaina_cover: "assets/monet.jpg"',
      'vlaina_cover_x: -200',
      'vlaina_cover_y: 900',
      'vlaina_cover_height: 1000000',
      'vlaina_cover_scale: 999',
      '---',
      '',
      '# Title',
    ].join('\n');

    expect(readNoteMetadataFromMarkdown(markdown).cover).toEqual({
      assetPath: 'assets/monet.jpg',
      positionX: 0,
      positionY: 100,
      height: 500,
      scale: 10,
    });
  });

  it('drops unsafe managed icon and cover strings from untrusted frontmatter', () => {
    const oversizedIcon = 'x'.repeat(4097);
    const oversizedCover = `${'a'.repeat(16 * 1024)}.png`;

    expect(readNoteMetadataFromMarkdown([
      '---',
      `vlaina_icon: "${oversizedIcon}"`,
      'vlaina_cover: "assets/\u202Ecod.exe.png"',
      '---',
      '# Title',
    ].join('\n'))).toEqual({});

    expect(readNoteMetadataFromMarkdown([
      '---',
      'vlaina_icon: "sparkles\u202E"',
      'vlaina_cover: "/etc/passwd"',
      '---',
      '# Title',
    ].join('\n'))).toEqual({});

    expect(readNoteMetadataFromMarkdown([
      '---',
      'vlaina_icon: "sparkles"',
      `vlaina_cover: "${oversizedCover}"`,
      '---',
      '# Title',
    ].join('\n'))).toEqual({
      icon: 'sparkles',
    });
  });

  it('drops managed cover paths inside internal folders while keeping user dot folders', () => {
    expect(readNoteMetadataFromMarkdown([
      '---',
      'vlaina_cover: ".vlaina/assets/cover.webp"',
      '---',
      '# Title',
    ].join('\n'))).toEqual({});

    expect(readNoteMetadataFromMarkdown([
      '---',
      'vlaina_cover: "docs/.git/cover.webp"',
      '---',
      '# Title',
    ].join('\n'))).toEqual({});

    expect(readNoteMetadataFromMarkdown([
      '---',
      'vlaina_cover: "%2evlaina/assets/cover.webp"',
      '---',
      '# Title',
    ].join('\n'))).toEqual({});

    expect(readNoteMetadataFromMarkdown([
      '---',
      'vlaina_cover: "docs%2f.git%2fcover.webp"',
      '---',
      '# Title',
    ].join('\n'))).toEqual({});

    expect(readNoteMetadataFromMarkdown([
      '---',
      'vlaina_cover: ".notes/assets/cover.webp"',
      '---',
      '# Title',
    ].join('\n'))).toEqual({
      cover: {
        assetPath: '.notes/assets/cover.webp',
      },
    });
  });

  it('keeps supported managed icon and cover string forms', () => {
    expect(readNoteMetadataFromMarkdown([
      '---',
      'vlaina_icon: " icon:sparkles:#ffcc00 "',
      'vlaina_cover: " @biva/1 "',
      '---',
      '# Title',
    ].join('\n'))).toEqual({
      icon: 'icon:sparkles:#ffcc00',
      cover: {
        assetPath: '@biva/1',
      },
    });

    expect(readNoteMetadataFromMarkdown([
      '---',
      'vlaina_icon: "img:/app/.vlaina/assets/icons/demo.png"',
      'vlaina_cover: "assets/cover.webp"',
      '---',
      '# Title',
    ].join('\n'))).toEqual({
      icon: 'img:/app/.vlaina/assets/icons/demo.png',
      cover: {
        assetPath: 'assets/cover.webp',
      },
    });
  });

  it('round-trips escaped managed YAML string scalars', () => {
    const metadata = {
      icon: 'quote " slash \\ icon',
      cover: {
        assetPath: 'assets/quote " slash \\ cover.webp',
      },
    };
    const written = writeNoteMetadataToMarkdown('# Title', metadata);

    expect(written).toContain('vlaina_icon: "quote \\" slash \\\\ icon"');
    expect(written).toContain('vlaina_cover: "assets/quote \\" slash \\\\ cover.webp"');
    expect(readNoteMetadataFromMarkdown(written)).toEqual(metadata);
    expect(writeNoteMetadataToMarkdown(written, readNoteMetadataFromMarkdown(written))).toBe(written);
  });

  it('updates managed fields without dropping markdown body content', () => {
    const markdown = '# Title\n\nBody';

    const result = updateNoteMetadataInMarkdown(markdown, {
      createdAt: Date.parse('2026-04-15T00:00:00.000Z'),
      updatedAt: Date.parse('2026-04-16T00:00:00.000Z'),
    });

    expect(result.metadata).toEqual({
      createdAt: Date.parse('2026-04-15T00:00:00.000Z'),
      updatedAt: Date.parse('2026-04-16T00:00:00.000Z'),
    });
    expect(result.content).toBe(
      [
        '---',
        'vlaina_created: 2026-04-15 08:00:00 +08:00',
        'vlaina_updated: 2026-04-16 08:00:00 +08:00',
        '---',
        '',
        '# Title',
        '',
        'Body',
      ].join('\n')
    );
  });

  it('preserves an empty body separator after existing frontmatter', () => {
    const markdown = [
      '---',
      'vlaina_icon: "😃"',
      'vlaina_updated: "2026-04-15T00:00:00.000Z"',
      '---',
      '',
    ].join('\n');

    const result = updateNoteMetadataInMarkdown(markdown, {
      updatedAt: Date.parse('2026-04-16T00:00:00.000Z'),
    });

    expect(result.content).toBe(
      [
        '---',
        'vlaina_icon: "😃"',
        'vlaina_updated: 2026-04-16 08:00:00 +08:00',
        '---',
        '',
      ].join('\n')
    );
  });

  it('strips hidden-only vlaina frontmatter from public markdown', () => {
    const markdown = [
      '---',
      'vlaina_cover: "@biva/1"',
      'vlaina_cover_x: 50',
      'vlaina_cover_y: 44.95904771244643',
      'vlaina_cover_height: 204',
      'vlaina_cover_scale: 1',
      'vlaina_created: "2026-04-19T16:30:35.881Z"',
      'vlaina_updated: "2026-04-22T13:18:03.350Z"',
      '---',
      '',
      '# Exported',
      'Visible body',
    ].join('\n');

    expect(stripManagedFrontmatter(markdown)).toBe('# Exported\nVisible body');
  });

  it('strips only the managed updated timestamp for save conflict comparisons', () => {
    const markdown = [
      '---',
      'title: User title',
      'vlaina_created: 2026-04-15 08:00:00 +08:00',
      'vlaina_updated: 2026-04-16 08:00:00 +08:00',
      '---',
      '',
      '# Title',
    ].join('\n');

    expect(stripUpdatedFrontmatter(markdown)).toBe([
      '---',
      'title: User title',
      'vlaina_created: 2026-04-15 08:00:00 +08:00',
      '---',
      '',
      '# Title',
    ].join('\n'));
  });

  it('preserves user frontmatter while stripping only top-level vlaina fields', () => {
    const markdown = [
      '---',
      'title: User title',
      'tags:',
      '  - project',
      'vlaina_cover: "@biva/1"',
      'nested:',
      '  vlaina_note: user nested value',
      '---',
      '# Exported',
    ].join('\n');

    expect(stripManagedFrontmatter(markdown)).toBe([
      '---',
      'title: User title',
      'tags:',
      '  - project',
      'nested:',
      '  vlaina_note: user nested value',
      '---',
      '# Exported',
    ].join('\n'));
  });

  it('ignores an unclosed oversized leading frontmatter candidate', () => {
    const markdown = [
      '---',
      ...Array.from({ length: 2050 }, (_, index) => `vlaina_icon: "hidden-${index}"`),
      '# Body',
    ].join('\n');

    expect(readNoteMetadataFromMarkdown(markdown)).toEqual({});
    expect(stripManagedFrontmatter(markdown)).toBe(markdown);
  });

  it('preserves an oversized unclosed frontmatter candidate when writing metadata', () => {
    const markdown = [
      '---',
      ...Array.from({ length: 2050 }, (_, index) => `line_${index}: value`),
      '# Body',
    ].join('\n');

    expect(
      writeNoteMetadataToMarkdown(markdown, {
        updatedAt: Date.parse('2026-04-16T00:00:00.000Z'),
      })
    ).toBe([
      '---',
      'vlaina_updated: 2026-04-16 08:00:00 +08:00',
      '---',
      '',
      markdown,
    ].join('\n'));
  });

  it('does not parse frontmatter that closes after the character budget', () => {
    const markdown = [
      '---',
      `vlaina_icon: "${'x'.repeat(256 * 1024)}"`,
      '---',
      '',
      '# Body',
    ].join('\n');

    expect(readNoteMetadataFromMarkdown(markdown)).toEqual({});
    expect(stripUpdatedFrontmatter(markdown)).toBe(markdown);
  });
});
