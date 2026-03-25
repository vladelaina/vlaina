import { describe, expect, it } from 'vitest';
import {
  getFrontmatterFenceLanguage,
  isFrontmatterFenceLanguage,
  isFrontmatterShortcutText,
  normalizeLeadingFrontmatterMarkdown,
  serializeLeadingFrontmatterMarkdown,
} from './frontmatterMarkdown';

describe('frontmatterMarkdown', () => {
  it('normalizes leading yaml frontmatter into an internal fenced block', () => {
    expect(normalizeLeadingFrontmatterMarkdown('---\ntitle: Demo\n---\n# Heading')).toBe(
      `\`\`\`${getFrontmatterFenceLanguage()}\ntitle: Demo\n\`\`\`\n# Heading`,
    );
  });

  it('normalizes any leading frontmatter block, including empty placeholders', () => {
    expect(normalizeLeadingFrontmatterMarkdown('---\n---\n# Heading')).toBe(
      `\`\`\`${getFrontmatterFenceLanguage()}\n\`\`\`\n# Heading`,
    );
  });

  it('serializes the internal fenced block back to markdown frontmatter', () => {
    expect(
      serializeLeadingFrontmatterMarkdown(
        `\`\`\`${getFrontmatterFenceLanguage()}\ntitle: Demo\n\`\`\`\n# Heading`,
      ),
    ).toBe('---\ntitle: Demo\n---\n# Heading');
  });

  it('recognizes frontmatter shortcut and fence language', () => {
    expect(isFrontmatterShortcutText('---')).toBe(true);
    expect(isFrontmatterShortcutText(' --- ')).toBe(true);
    expect(isFrontmatterShortcutText('--')).toBe(false);
    expect(isFrontmatterFenceLanguage(getFrontmatterFenceLanguage())).toBe(true);
    expect(isFrontmatterFenceLanguage('yaml')).toBe(false);
  });
});
