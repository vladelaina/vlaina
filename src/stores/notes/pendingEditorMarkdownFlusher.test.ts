import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushCurrentPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from './pendingEditorMarkdownFlusher';

describe('pendingEditorMarkdownFlusher', () => {
  beforeEach(() => {
    setPendingEditorMarkdownFlusher(null);
  });

  it('flushes the currently registered pending editor markdown flusher', () => {
    const flusher = vi.fn(() => true);

    setPendingEditorMarkdownFlusher(flusher);

    expect(flushCurrentPendingEditorMarkdown()).toBe(true);
    expect(flusher).toHaveBeenCalledTimes(1);
  });

  it('keeps a newer flusher when an older registration is cleaned up', () => {
    const olderFlusher = vi.fn(() => false);
    const newerFlusher = vi.fn(() => true);

    const cleanupOlderFlusher = setPendingEditorMarkdownFlusher(olderFlusher);
    setPendingEditorMarkdownFlusher(newerFlusher);
    cleanupOlderFlusher();

    expect(flushCurrentPendingEditorMarkdown()).toBe(true);
    expect(olderFlusher).not.toHaveBeenCalled();
    expect(newerFlusher).toHaveBeenCalledTimes(1);
  });

  it('clears the current flusher when the matching registration is cleaned up', () => {
    const flusher = vi.fn(() => true);

    const cleanupFlusher = setPendingEditorMarkdownFlusher(flusher);
    cleanupFlusher();

    expect(flushCurrentPendingEditorMarkdown()).toBe(false);
    expect(flusher).not.toHaveBeenCalled();
  });
});
