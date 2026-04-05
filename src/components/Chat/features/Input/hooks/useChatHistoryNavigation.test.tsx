import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useChatHistoryNavigation } from './useChatHistoryNavigation';

describe('useChatHistoryNavigation', () => {
  it('browses backward from the latest sent message and restores the draft on the way out', () => {
    const applyHistoryMessage = vi.fn();
    const { result, rerender } = renderHook(
      ({ message }) =>
        useChatHistoryNavigation({
          message,
          sentUserMessages: ['first', 'second'],
          showMentionPicker: false,
          applyHistoryMessage,
        }),
      {
        initialProps: { message: 'draft' },
      },
    );

    const preventDefault = vi.fn();

    act(() => {
      const handled = result.current.handleHistoryKeyDown({
        key: 'ArrowUp',
        selectionStart: 0,
        selectionEnd: 0,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault,
      });
      expect(handled).toBe(true);
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(applyHistoryMessage).toHaveBeenLastCalledWith('second');
    expect(result.current.historyBrowseIndex).toBe(1);

    rerender({ message: 'second' });

    act(() => {
      result.current.handleHistoryKeyDown({
        key: 'ArrowDown',
        selectionStart: 6,
        selectionEnd: 6,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
      });
    });

    expect(applyHistoryMessage).toHaveBeenLastCalledWith('draft');
    expect(result.current.historyBrowseIndex).toBeNull();
  });

  it('does not browse history while the mention picker is open', () => {
    const applyHistoryMessage = vi.fn();
    const { result } = renderHook(() =>
      useChatHistoryNavigation({
        message: 'draft',
        sentUserMessages: ['first'],
        showMentionPicker: true,
        applyHistoryMessage,
      }),
    );

    const preventDefault = vi.fn();

    act(() => {
      const handled = result.current.handleHistoryKeyDown({
        key: 'ArrowUp',
        selectionStart: 0,
        selectionEnd: 0,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault,
      });
      expect(handled).toBe(false);
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(applyHistoryMessage).not.toHaveBeenCalled();
    expect(result.current.historyBrowseIndex).toBeNull();
  });

  it('clears browsing state when the user edits the draft directly', () => {
    const { result } = renderHook(() =>
      useChatHistoryNavigation({
        message: 'draft',
        sentUserMessages: ['first'],
        showMentionPicker: false,
        applyHistoryMessage: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleHistoryKeyDown({
        key: 'ArrowUp',
        selectionStart: 0,
        selectionEnd: 0,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
      });
    });

    expect(result.current.historyBrowseIndex).toBe(0);

    act(() => {
      result.current.clearHistoryNavigationOnInput();
    });

    expect(result.current.historyBrowseIndex).toBeNull();
  });
});
