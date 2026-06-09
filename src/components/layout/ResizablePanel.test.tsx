import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResizablePanel } from './ResizablePanel';

function dispatchStorageChange(key: string, newValue: string): void {
  const event = new Event('storage') as StorageEvent;
  Object.defineProperties(event, {
    key: { value: key },
    newValue: { value: newValue },
    storageArea: { value: localStorage },
  });
  window.dispatchEvent(event);
}

describe('ResizablePanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads a persisted width clamped to the panel limits', () => {
    localStorage.setItem('panel-width', '9999');

    const { container } = render(
      <ResizablePanel storageKey="panel-width" minWidth={300} maxWidth={500}>
        content
      </ResizablePanel>
    );

    expect(container.querySelector('aside')).toHaveStyle({ width: '500px' });
  });

  it('updates width when another window changes the persisted storage key', () => {
    const onWidthChange = vi.fn();
    const { container } = render(
      <ResizablePanel
        storageKey="panel-width"
        defaultWidth={320}
        minWidth={300}
        maxWidth={500}
        onWidthChange={onWidthChange}
      >
        content
      </ResizablePanel>
    );

    act(() => {
      dispatchStorageChange('panel-width', '460');
    });

    expect(container.querySelector('aside')).toHaveStyle({ width: '460px' });
    expect(onWidthChange).toHaveBeenCalledWith(460);
  });

  it('ignores malformed external width changes', () => {
    const { container } = render(
      <ResizablePanel storageKey="panel-width" defaultWidth={320} minWidth={300} maxWidth={500}>
        content
      </ResizablePanel>
    );

    act(() => {
      dispatchStorageChange('panel-width', 'wide');
    });

    expect(container.querySelector('aside')).toHaveStyle({ width: '320px' });
  });

  it('ignores oversized persisted width values', () => {
    localStorage.setItem('panel-width', '4'.repeat(1024));

    const { container } = render(
      <ResizablePanel storageKey="panel-width" defaultWidth={320} minWidth={300} maxWidth={500}>
        content
      </ResizablePanel>
    );

    expect(container.querySelector('aside')).toHaveStyle({ width: '320px' });

    act(() => {
      dispatchStorageChange('panel-width', '4'.repeat(1024));
    });

    expect(container.querySelector('aside')).toHaveStyle({ width: '320px' });
  });
});
