import { describe, expect, it, vi } from 'vitest';
import { createToolbarEventDelegation } from './toolbarInteractions';

describe('toolbar interactions', () => {
  it('prevents default when pressing blank space inside the toolbar', () => {
    const toolbar = document.createElement('div');
    const blank = document.createElement('div');
    toolbar.appendChild(blank);
    document.body.appendChild(toolbar);

    const delegation = createToolbarEventDelegation(toolbar);
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');

    blank.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(stopPropagation).toHaveBeenCalled();

    delegation.destroy();
  });

  it('does not prevent default for native controls inside the toolbar', () => {
    const toolbar = document.createElement('div');
    const select = document.createElement('select');
    toolbar.appendChild(select);
    document.body.appendChild(toolbar);

    const delegation = createToolbarEventDelegation(toolbar);
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');

    select.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(stopPropagation).not.toHaveBeenCalled();

    delegation.destroy();
  });
});
