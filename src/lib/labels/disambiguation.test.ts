import { describe, expect, it } from 'vitest';
import { buildDuplicateLabelRegistry } from './disambiguation';

describe('buildDuplicateLabelRegistry', () => {
  it('returns minimal suffix hints for duplicate labels', () => {
    const registry = buildDuplicateLabelRegistry([
      {
        id: 'a',
        label: 'Roadmap',
        hintSegments: ['Product', 'Docs'],
      },
      {
        id: 'b',
        label: 'Roadmap',
        hintSegments: ['Marketing', 'Docs'],
      },
    ]);

    expect(registry.get('a')).toBe('Product / Docs');
    expect(registry.get('b')).toBe('Marketing / Docs');
  });

  it('does not emit hints for unique labels', () => {
    const registry = buildDuplicateLabelRegistry([
      {
        id: 'a',
        label: 'Roadmap',
        hintSegments: ['Product', 'Docs'],
      },
      {
        id: 'b',
        label: 'Meeting Notes',
        hintSegments: ['Marketing', 'Docs'],
      },
    ]);

    expect(registry.size).toBe(0);
  });

  it('uses the shortest unique suffix available', () => {
    const registry = buildDuplicateLabelRegistry([
      {
        id: 'a',
        label: 'Sync',
        hintSegments: ['A1B2', 'Mar 28, 2026', '10:00 AM'],
      },
      {
        id: 'b',
        label: 'Sync',
        hintSegments: ['C3D4', 'Mar 28, 2026', '11:00 AM'],
      },
    ]);

    expect(registry.get('a')).toBe('10:00 AM');
    expect(registry.get('b')).toBe('11:00 AM');
  });
});
