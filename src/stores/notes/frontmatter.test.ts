import { describe, expect, it } from 'vitest';
import {
  readNoteMetadataFromMarkdown,
  updateNoteMetadataInMarkdown,
  writeNoteMetadataToMarkdown,
} from './frontmatter';

describe('note frontmatter metadata', () => {
  it('reads managed note metadata from leading yaml frontmatter', () => {
    const markdown = [
      '---',
      'cover: "assets/monet.jpg"',
      'cover_x: 40',
      'cover_y: 60',
      'cover_height: 220',
      'cover_scale: 1.3',
      'icon: "🐱"',
      'created: "2026-04-15T01:02:03.000Z"',
      'updated: "2026-04-16T01:02:03.000Z"',
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
        '',
        'icon: "🐱"',
        'updated: "2026-04-16T00:00:00.000Z"',
        '---',
        '',
        '# Title',
      ].join('\n')
    );
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
        'created: "2026-04-15T00:00:00.000Z"',
        'updated: "2026-04-16T00:00:00.000Z"',
        '---',
        '',
        '# Title',
        '',
        'Body',
      ].join('\n')
    );
  });
});
