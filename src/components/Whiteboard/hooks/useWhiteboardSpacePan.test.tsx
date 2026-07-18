import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWhiteboardSpacePan } from './useWhiteboardSpacePan';

describe('useWhiteboardSpacePan', () => {
  it('releases temporary panning when the window loses focus', () => {
    const { result } = renderHook(() => useWhiteboardSpacePan(true));

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })));
    expect(result.current.spacePressed).toBe(true);
    expect(result.current.spacePressedRef.current).toBe(true);

    act(() => window.dispatchEvent(new Event('blur')));
    expect(result.current.spacePressed).toBe(false);
    expect(result.current.spacePressedRef.current).toBe(false);
  });
});
