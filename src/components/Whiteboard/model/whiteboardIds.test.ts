import { describe, expect, it } from 'vitest';
import { getNextWhiteboardIdSequence } from './whiteboardIds';

describe('getNextWhiteboardIdSequence', () => {
  it('continues after the largest saved numeric suffix', () => {
    expect(getNextWhiteboardIdSequence([
      { id: 'wb-stroke-1' },
      { id: 'wb-stroke-19' },
      { id: 'wb-stroke-copy' },
      { id: 'other-100' },
    ], 'wb-stroke-')).toBe(20);
  });

  it('starts at one when no matching IDs exist', () => {
    expect(getNextWhiteboardIdSequence([{ id: 'wb-image-123' }], 'wb-connector-')).toBe(1);
  });
});
