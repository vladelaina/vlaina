import { describe, expect, it, vi } from 'vitest';
import {
  getAssistantOutputTextLength,
  takeAssistantOutputTextPrefix,
} from './useAssistantOutputText';

describe('assistant output text helpers', () => {
  it('takes prefixes by code point without materializing text arrays', () => {
    const arrayFromSpy = vi.spyOn(Array, 'from').mockImplementation(() => {
      throw new Error('Array.from should not be used for assistant output text helpers');
    });

    try {
      expect(getAssistantOutputTextLength('a🙂b')).toBe(3);
      expect(takeAssistantOutputTextPrefix('a🙂b', 2)).toBe('a🙂');
    } finally {
      arrayFromSpy.mockRestore();
    }
  });
});
