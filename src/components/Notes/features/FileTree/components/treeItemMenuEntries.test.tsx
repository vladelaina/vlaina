import { describe, expect, it, vi } from 'vitest';
import { createTreeItemOpenLocationEntry } from './treeItemMenuEntries';

describe('createTreeItemOpenLocationEntry', () => {
  it('opens the item location before closing its menu', async () => {
    const calls: string[] = [];
    const entry = createTreeItemOpenLocationEntry({
      label: 'Open File Location',
      onClose: () => calls.push('close'),
      onOpenLocation: vi.fn(async () => {
        calls.push('open');
      }),
    });

    if (entry.kind === 'divider' || entry.kind === 'submenu') {
      throw new Error('Expected an action entry.');
    }
    await entry.onClick();

    expect(calls).toEqual(['open', 'close']);
  });
});
