import { describe, expect, it } from 'vitest';
import {
  cloneGraphNodePositions,
  syncGraphNodePositions,
} from './graphPositionSnapshot';

describe('graph position snapshots', () => {
  it('reuses frame positions without mutating a committed clone', () => {
    const positions = syncGraphNodePositions(
      new Map([['Alpha.md', { x: 10, y: 20 }]]),
      {},
    );
    const position = positions['Alpha.md'];
    const committed = cloneGraphNodePositions(positions);

    syncGraphNodePositions(
      new Map([['Alpha.md', { x: 30, y: 40 }]]),
      positions,
    );

    expect(positions['Alpha.md']).toBe(position);
    expect(positions['Alpha.md']).toEqual({ x: 30, y: 40 });
    expect(committed['Alpha.md']).toEqual({ x: 10, y: 20 });
  });
});
