import { describe, expect, it } from 'vitest';
import {
  areOutlineHeadingsEqual,
  createOutlineHeadingId,
  getHeadingLevelFromTagName,
  normalizeHeadingText,
} from './outlineUtils';

describe('outlineUtils', () => {
  it('parses heading levels from tag names', () => {
    expect(getHeadingLevelFromTagName('H1')).toBe(1);
    expect(getHeadingLevelFromTagName('h6')).toBe(6);
    expect(getHeadingLevelFromTagName('div')).toBeNull();
    expect(getHeadingLevelFromTagName('h9')).toBeNull();
  });

  it('normalizes heading text and falls back for blank values', () => {
    expect(normalizeHeadingText('  Hello   World  ')).toBe('Hello World');
    expect(normalizeHeadingText('   ')).toBe('Untitled');
  });

  it('creates stable outline ids', () => {
    expect(createOutlineHeadingId(0, 2, 'My Heading')).toBe('outline-0-h2-my-heading');
    expect(createOutlineHeadingId(7, 4, '###')).toBe('outline-7-h4-heading');
  });

  it('compares outline arrays by semantic fields', () => {
    const left = [
      { id: 'a', level: 1, text: 'A' },
      { id: 'b', level: 2, text: 'B' },
    ];

    const right = [
      { id: 'a', level: 1, text: 'A' },
      { id: 'b', level: 2, text: 'B' },
    ];

    const changed = [
      { id: 'a', level: 1, text: 'A1' },
      { id: 'b', level: 2, text: 'B' },
    ];

    expect(areOutlineHeadingsEqual(left, right)).toBe(true);
    expect(areOutlineHeadingsEqual(left, changed)).toBe(false);
    expect(areOutlineHeadingsEqual(left, left.slice(0, 1))).toBe(false);
  });
});
