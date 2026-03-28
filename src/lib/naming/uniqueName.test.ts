import { describe, expect, it } from 'vitest';
import { resolveUniqueNameSync } from './uniqueName';

describe('resolveUniqueNameSync', () => {
  it('returns the original name when there is no conflict', () => {
    expect(resolveUniqueNameSync('Roadmap', ['Notes', 'Archive'])).toBe('Roadmap');
  });

  it('appends an incrementing suffix for plain names', () => {
    expect(resolveUniqueNameSync('Roadmap', ['Roadmap', 'Roadmap 1', 'Roadmap 2'])).toBe('Roadmap 3');
  });

  it('appends the suffix before the extension for file names', () => {
    expect(
      resolveUniqueNameSync('Roadmap.md', ['Roadmap.md', 'Roadmap 1.md'], { splitExtension: true })
    ).toBe('Roadmap 2.md');
  });

  it('continues incrementing an existing numeric suffix instead of duplicating it', () => {
    expect(resolveUniqueNameSync('Roadmap 2.md', ['Roadmap.md', 'Roadmap 2.md'], { splitExtension: true })).toBe(
      'Roadmap 3.md'
    );
  });
});
