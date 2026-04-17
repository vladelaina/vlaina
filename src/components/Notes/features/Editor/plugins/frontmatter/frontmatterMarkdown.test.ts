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

  it('hides vlaina-managed frontmatter fields from the editor block', () => {
    expect(
      normalizeLeadingFrontmatterMarkdown(
        '---\ntitle: Demo\nvlaina_cover: "@biva/1"\nvlaina_icon: "🧏‍♂️"\n---\n# Heading'
      )
    ).toBe(`\`\`\`${getFrontmatterFenceLanguage()}\ntitle: Demo\n\`\`\`\n# Heading`);
  });

  it('normalizes any leading frontmatter block, including empty placeholders', () => {
    expect(normalizeLeadingFrontmatterMarkdown('---\n---\n# Heading')).toBe('# Heading');
  });

  it('removes hidden-only frontmatter from the editor surface', () => {
    expect(
      normalizeLeadingFrontmatterMarkdown('---\nvlaina_cover: "@biva/1"\nvlaina_updated: "2026-04-16T00:00:00.000Z"\n---\n# Heading')
    ).toBe('# Heading');
  });

  it('serializes the internal fenced block back to markdown frontmatter', () => {
    expect(
      serializeLeadingFrontmatterMarkdown(
        `\`\`\`${getFrontmatterFenceLanguage()}\ntitle: Demo\n\`\`\`\n# Heading`,
      ),
    ).toBe('---\ntitle: Demo\n---\n# Heading');
  });

  it('merges hidden vlaina-managed frontmatter back during serialization', () => {
    expect(
      serializeLeadingFrontmatterMarkdown(
        `\`\`\`${getFrontmatterFenceLanguage()}\ntitle: Demo\n\`\`\`\n# Heading`,
        '---\ntitle: Demo\nvlaina_cover: "@biva/1"\nvlaina_updated: "2026-04-16T00:00:00.000Z"\n---\n# Heading',
      ),
    ).toBe(
      '---\ntitle: Demo\n\nvlaina_cover: "@biva/1"\nvlaina_updated: "2026-04-16T00:00:00.000Z"\n---\n# Heading'
    );
  });

  it('restores hidden vlaina-managed frontmatter when the editor shows no frontmatter block', () => {
    expect(
      serializeLeadingFrontmatterMarkdown(
        '# Heading',
        '---\nvlaina_cover: "@biva/1"\nvlaina_updated: "2026-04-16T00:00:00.000Z"\n---\n# Heading',
      ),
    ).toBe(
      '---\nvlaina_cover: "@biva/1"\nvlaina_updated: "2026-04-16T00:00:00.000Z"\n---\n# Heading'
    );
  });

  it('recognizes frontmatter shortcut and fence language', () => {
    expect(isFrontmatterShortcutText('---')).toBe(true);
    expect(isFrontmatterShortcutText(' --- ')).toBe(true);
    expect(isFrontmatterShortcutText('--')).toBe(false);
    expect(isFrontmatterFenceLanguage(getFrontmatterFenceLanguage())).toBe(true);
    expect(isFrontmatterFenceLanguage('yaml')).toBe(false);
  });
});
