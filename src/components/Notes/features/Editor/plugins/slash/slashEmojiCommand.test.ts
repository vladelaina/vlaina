import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shouldUpdateSlashEmojiPreview } from './slashEmojiCommand';

describe('slash emoji preview', () => {
  it('does not dispatch another preview update for the same emoji at the same position', () => {
    expect(shouldUpdateSlashEmojiPreview({ emoji: '🚀', pos: 12 }, '🚀', 12)).toBe(false);
    expect(shouldUpdateSlashEmojiPreview({ emoji: '🚀', pos: 12 }, '✨', 12)).toBe(true);
    expect(shouldUpdateSlashEmojiPreview({ emoji: '🚀', pos: 12 }, '🚀', 13)).toBe(true);
  });

  it('renders inline hover preview without taking text layout space', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/components/Notes/features/Editor/styles/slash-menu.css'),
      'utf8'
    );
    const previewRule = css.match(/\.slash-emoji-inline-preview\s*\{[^}]+\}/)?.[0] ?? '';

    expect(previewRule).toContain('display: inline-block');
    expect(previewRule).toContain('width: 0');
    expect(previewRule).toContain('height: 0');
    expect(previewRule).toContain('overflow: visible');
    expect(previewRule).not.toContain('top:');

    const emptyBlockRule = css.match(/\.slash-emoji-inline-preview-empty-block\s*\{[^}]+\}/)?.[0] ?? '';
    expect(emptyBlockRule).toContain('top: calc(1lh - 1em)');
  });
});
