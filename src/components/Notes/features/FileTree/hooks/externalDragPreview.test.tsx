import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExternalDragPreview } from './externalDragPreview';

const mocks = vi.hoisted(() => ({
  stat: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getBaseName: (path: string) => path.split('/').pop() ?? '',
  getStorageAdapter: () => ({
    stat: mocks.stat,
  }),
}));

describe('createExternalDragPreview', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    document.body.style.cursor = '';
    mocks.stat.mockReset();
  });

  it('cleans global drag state if preview host insertion fails', () => {
    document.body.style.cursor = 'default';
    const childCountBefore = document.body.childElementCount;
    vi.spyOn(document.body, 'appendChild').mockImplementationOnce(() => {
      throw new Error('append failed');
    });

    expect(() => createExternalDragPreview(['/vault/demo.md'])).toThrow('append failed');

    expect(document.body.style.cursor).toBe('default');
    expect(document.body.childElementCount).toBe(childCountBefore);
  });
});
