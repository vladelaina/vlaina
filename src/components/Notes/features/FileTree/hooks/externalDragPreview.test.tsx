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
    if (vi.isFakeTimers()) {
      vi.runOnlyPendingTimers();
    }
    vi.useRealTimers();
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

  it('defers React root unmount on normal disposal', () => {
    vi.useFakeTimers();
    mocks.stat.mockResolvedValue({ isDirectory: false });
    document.body.style.cursor = 'default';
    const childCountBefore = document.body.childElementCount;

    const preview = createExternalDragPreview(['/vault/demo.md']);
    expect(document.body.childElementCount).toBe(childCountBefore + 1);

    preview.dispose();

    expect(document.body.style.cursor).toBe('default');
    expect(document.body.childElementCount).toBe(childCountBefore + 1);

    vi.runOnlyPendingTimers();

    expect(document.body.childElementCount).toBe(childCountBefore);
  });
});
