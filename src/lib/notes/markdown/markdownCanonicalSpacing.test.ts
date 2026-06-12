import { describe, expect, it } from 'vitest';
import { normalizeCanonicalMarkdownSpacingForPersistence } from './markdownCanonicalSpacing';

describe('markdown canonical spacing', () => {
  it('spreads adjacent list items inside emoji callouts', () => {
    expect(
      normalizeCanonicalMarkdownSpacingForPersistence(
        ['> 💡 Callout', '>', '> - First', '> - Second'].join('\n')
      )
    ).toBe(['> 💡 Callout', '>', '> - First', '>', '> - Second'].join('\n'));
  });

  it('does not treat text-presentation symbol blockquotes as callouts', () => {
    expect(
      normalizeCanonicalMarkdownSpacingForPersistence(
        ['> © Copyright', '>', '> - First', '> - Second', '', '> ™ Trademark'].join('\n')
      )
    ).toBe(['> © Copyright', '>', '> - First', '> - Second', '', '> ™ Trademark'].join('\n'));
  });

  it('does not canonicalize leading thematic breaks into frontmatter openers', () => {
    expect(
      normalizeCanonicalMarkdownSpacingForPersistence(
        [' ***', 'url: http\\://example.test', ' ***', '', 'Body'].join('\n')
      )
    ).toBe([' ***', 'url: http\\://example.test', '---', '', 'Body'].join('\n'));
  });

  it('canonicalizes thematic breaks after leading frontmatter', () => {
    expect(
      normalizeCanonicalMarkdownSpacingForPersistence(
        ['---', 'title: Demo', '---', '', '***', '', 'Body'].join('\n')
      )
    ).toBe(['---', 'title: Demo', '---', '', '---', '', 'Body'].join('\n'));
  });
});
