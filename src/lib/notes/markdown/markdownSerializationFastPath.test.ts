import { describe, expect, it } from 'vitest';
import { normalizeSerializedMarkdownDocument } from './markdownSerializationUtils';

function createLargePlainMarkdown(specialLine: string): string {
  const paragraph = 'This is a long plain paragraph for large markdown normalization. '.repeat(200);
  return [
    '# Large Fast Path Boundary',
    '',
    specialLine,
    '',
    ...Array.from({ length: 90 }, (_value, index) => `Paragraph ${index}. ${paragraph}`),
  ].join('\n\n');
}

describe('large markdown serialization fast path', () => {
  it('does not skip mailto link normalization', () => {
    const markdown = createLargePlainMarkdown(
      '[user@example.com](mailto:user@example.com)',
    );

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(
      markdown.replace('[user@example.com](mailto:user@example.com)', 'user@example.com'),
    );
  });

  it('does not skip case-insensitive mailto link normalization', () => {
    const markdown = createLargePlainMarkdown(
      '[USER@EXAMPLE.TEST](MAILTO:user@example.test)',
    );

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(
      markdown.replace('[USER@EXAMPLE.TEST](MAILTO:user@example.test)', 'USER@EXAMPLE.TEST'),
    );
  });

  it('does not skip leading markdown space entity normalization', () => {
    const markdown = createLargePlainMarkdown('&#32;Indented paragraph');

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(
      markdown.replace('&#32;Indented paragraph', ' Indented paragraph'),
    );
  });
});
