import { describe, expect, it } from 'vitest';
import {
  createFilledCodePointTimings,
  getCodePointLength,
} from './chatStreamTextMetrics';

describe('chatStreamTextMetrics', () => {
  it('counts surrogate-pair characters as one stream character', () => {
    expect(getCodePointLength('a🙂b')).toBe(3);
    expect(createFilledCodePointTimings('a🙂b', 12)).toEqual([12, 12, 12]);
  });
});
