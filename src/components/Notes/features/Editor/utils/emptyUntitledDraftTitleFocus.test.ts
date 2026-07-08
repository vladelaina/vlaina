import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNotesStore } from '@/stores/useNotesStore';
import { NATIVE_CARET_OVERLAY_REFRESH_EVENT } from '@/hooks/useNativeCaretOverlay';
import { NOTE_TITLE_INPUT_DATA_ATTR } from './titleInputDom';
import {
  focusCurrentEmptyUntitledDraftTitle,
  shouldFocusCurrentEmptyUntitledDraftTitle,
} from './emptyUntitledDraftTitleFocus';

describe('emptyUntitledDraftTitleFocus', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    useNotesStore.setState(useNotesStore.getInitialState(), true);
  });

  it('focuses the title for the current empty untitled draft', () => {
    const input = document.createElement('textarea');
    input.setAttribute(NOTE_TITLE_INPUT_DATA_ATTR, 'true');
    document.body.appendChild(input);
    const caretRefreshListener = vi.fn();
    document.addEventListener(NATIVE_CARET_OVERLAY_REFRESH_EVENT, caretRefreshListener);

    try {
      useNotesStore.setState({
        currentNote: { path: 'draft:test', content: '#' },
        draftNotes: { 'draft:test': { parentPath: null, name: '' } },
        noteMetadata: { version: 2, notes: {} },
      });

      expect(shouldFocusCurrentEmptyUntitledDraftTitle()).toBe(true);
      expect(focusCurrentEmptyUntitledDraftTitle()).toBe(true);
      expect(document.activeElement).toBe(input);
      expect(caretRefreshListener).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener(NATIVE_CARET_OVERLAY_REFRESH_EVENT, caretRefreshListener);
    }
  });

  it('does not focus the title after the draft has body content', () => {
    const input = document.createElement('textarea');
    input.setAttribute(NOTE_TITLE_INPUT_DATA_ATTR, 'true');
    document.body.appendChild(input);

    useNotesStore.setState({
      currentNote: { path: 'draft:test', content: 'Body' },
      draftNotes: { 'draft:test': { parentPath: null, name: '' } },
      noteMetadata: { version: 2, notes: {} },
    });

    expect(shouldFocusCurrentEmptyUntitledDraftTitle()).toBe(false);
    expect(focusCurrentEmptyUntitledDraftTitle()).toBe(false);
    expect(document.activeElement).not.toBe(input);
  });
});
