import { describe, expect, it } from 'vitest';
import { findExportMarkdownAssetSourceTokens } from './noteExportMarkdownAssetTokens';

describe('findExportMarkdownAssetSourceTokens', () => {
  it('keeps asset extraction correct after many ignored inline ranges', () => {
    const ignoredImages = Array.from(
      { length: 1500 },
      (_, index) => `\`![ignored ${index}](img:ignored-${index}.png) <img src="img:ignored-${index}.png">\``,
    );
    const markdown = [
      ...ignoredImages,
      '![real](img:real.png)',
      '<img src="img:real-html.png">',
    ].join('\n');

    expect(findExportMarkdownAssetSourceTokens(markdown).map((token) => token.lookupSrc)).toEqual([
      'img:real.png',
      'img:real-html.png',
    ]);
  });

  it('does not treat plain angle-bracket text as an HTML tag range', () => {
    const markdown = '< not html ![real](img:real.png) >';

    expect(findExportMarkdownAssetSourceTokens(markdown).map((token) => token.lookupSrc)).toEqual([
      'img:real.png',
    ]);
  });
});
