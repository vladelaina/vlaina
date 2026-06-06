import { describe, expect, it } from 'vitest';
import {
  MAX_EXPORT_MARKDOWN_ASSET_TOKENS,
  findExportMarkdownAssetSourceTokens,
  findExportMarkdownAssetSourceTokensWithOptions,
} from './noteExportMarkdownAssetTokens';

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

  it('bounds export asset extraction work when requested', () => {
    const markdown = Array.from(
      { length: MAX_EXPORT_MARKDOWN_ASSET_TOKENS + 1 },
      (_, index) => `![image ${index}](img:image-${index}.png)`,
    ).join('\n');

    const tokens = findExportMarkdownAssetSourceTokensWithOptions(markdown, {
      maxTokens: MAX_EXPORT_MARKDOWN_ASSET_TOKENS,
    });

    expect(tokens).toHaveLength(MAX_EXPORT_MARKDOWN_ASSET_TOKENS);
    expect(tokens.at(-1)?.lookupSrc).toBe(`img:image-${MAX_EXPORT_MARKDOWN_ASSET_TOKENS - 1}.png`);
  });

  it('bounds srcset asset extraction without building every candidate', () => {
    const srcset = Array.from(
      { length: MAX_EXPORT_MARKDOWN_ASSET_TOKENS + 1 },
      (_, index) => `img:image-${index}.png 1x`,
    ).join(', ');
    const tokens = findExportMarkdownAssetSourceTokensWithOptions(`<source srcset="${srcset}">`, {
      maxTokens: MAX_EXPORT_MARKDOWN_ASSET_TOKENS,
    });

    expect(tokens).toHaveLength(MAX_EXPORT_MARKDOWN_ASSET_TOKENS);
    expect(tokens.at(-1)?.lookupSrc).toBe(`img:image-${MAX_EXPORT_MARKDOWN_ASSET_TOKENS - 1}.png`);
  });
});
