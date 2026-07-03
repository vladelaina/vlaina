import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useModalBehavior } from './useModalBehavior';

describe('useModalBehavior', () => {
  it('does not close or cancel editing while IME composition is active', () => {
    const onClose = vi.fn();
    const onCancelEdit = vi.fn();

    renderHook(() => useModalBehavior({
      open: true,
      onClose,
      isEditing: true,
      onCancelEdit,
    }));

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'isComposing', { value: true });
    window.dispatchEvent(event);

    expect(onClose).not.toHaveBeenCalled();
    expect(onCancelEdit).not.toHaveBeenCalled();
  });
});
