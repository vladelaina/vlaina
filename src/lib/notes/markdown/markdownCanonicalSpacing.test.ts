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
});
