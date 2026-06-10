import { describe, expect, it } from 'vitest';
import { scrubOverflowMarkdownDataImages } from './overflowDataImageScrubber';

describe('overflowDataImageScrubber', () => {
  it('keeps escaped markdown data image examples literal', () => {
    const content = String.raw`\![example](<data:image/png;base64,abc>)`;

    expect(scrubOverflowMarkdownDataImages(content, {
      replacement: '[image]',
      maxTargetChars: 4096,
    })).toBe(content);
  });

  it('scrubs markdown data images with even backslash prefixes', () => {
    const content = String.raw`\\![example](<data:image/png;base64,abc>)`;

    expect(scrubOverflowMarkdownDataImages(content, {
      replacement: '[image]',
      maxTargetChars: 4096,
    })).toBe(String.raw`\\[image]`);
  });

  it('keeps markdown data image examples inside code spans and fenced code', () => {
    const content = [
      String.raw`Inline \`![example](<data:image/png;base64,abc>)\``,
      '```md',
      '![example](<data:image/png;base64,abc>)',
      '```',
      '![real](<data:image/png;base64,abc>)',
    ].join('\n');

    expect(scrubOverflowMarkdownDataImages(content, {
      replacement: '[image]',
      maxTargetChars: 4096,
    })).toBe([
      String.raw`Inline \`![example](<data:image/png;base64,abc>)\``,
      '```md',
      '![example](<data:image/png;base64,abc>)',
      '```',
      '[image]',
    ].join('\n'));
  });

  it('scrubs entity-encoded markdown data image targets', () => {
    const content = '![real](<data&colon;image&sol;png&semi;base64&comma;abc>)';

    expect(scrubOverflowMarkdownDataImages(content, {
      replacement: '[image]',
      maxTargetChars: 4096,
    })).toBe('[image]');
  });

  it('scrubs markdown data images with long labels', () => {
    const content = `![${'a'.repeat(2048)}](<data:image/png;base64,abc>)`;

    expect(scrubOverflowMarkdownDataImages(content, {
      replacement: '[image]',
      maxTargetChars: 4096,
    })).toBe('[image]');
  });
});
