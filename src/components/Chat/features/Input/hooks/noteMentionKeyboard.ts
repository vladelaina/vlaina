import type { Dispatch, SetStateAction, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import type { NoteMentionCandidate } from '../noteMentionHelpers';
import type { MentionPreviewRange } from './noteMentionStateTypes';

export function isMentionPreviewRange(part: { type: string; mention?: unknown }): part is MentionPreviewRange {
  return part.type === 'mention' && !!part.mention;
}

export function getMentionBoundaryEnd(value: string, part: MentionPreviewRange): number {
  return value[part.end] === ' ' ? part.end + 1 : part.end;
}

export function handleNoteMentionKeyDown({
  activeMentionIndex,
  applyMentionCandidate,
  deleteSelectionRange,
  event,
  filteredCandidates,
  mentionRanges,
  mentions,
  removeLastMentionOnBoundary,
  removeMention,
  setActiveMentionIndex,
  setCaretIndex,
  setTextareaCaretIndex,
  showMentionPicker,
  value,
}: {
  activeMentionIndex: number;
  applyMentionCandidate: (candidate: NoteMentionCandidate) => void;
  deleteSelectionRange: (selectionStart: number, selectionEnd: number, overlappedMentions: NoteMentionReference[]) => void;
  event: ReactKeyboardEvent<HTMLTextAreaElement>;
  filteredCandidates: NoteMentionCandidate[];
  mentionRanges: MentionPreviewRange[];
  mentions: NoteMentionReference[];
  removeLastMentionOnBoundary: boolean;
  removeMention: (path: string, rangeStart?: number, rangeEnd?: number) => void;
  setActiveMentionIndex: Dispatch<SetStateAction<number>>;
  setCaretIndex: Dispatch<SetStateAction<number>>;
  setTextareaCaretIndex: (nextCaretIndex: number) => void;
  showMentionPicker: boolean;
  value: string;
}) {
  const native = event.nativeEvent as (KeyboardEvent & { isComposing?: boolean; keyCode?: number }) | undefined;
  if (native?.isComposing || native?.keyCode === 229) {
    return false;
  }

  const selectionStart = event.currentTarget.selectionStart ?? 0;
  const selectionEnd = event.currentTarget.selectionEnd ?? 0;

  if (event.key === 'Backspace' || event.key === 'Delete') {
    if (selectionStart !== selectionEnd) {
      const overlapped = mentionRanges.filter(
        (part) => selectionStart < part.end && selectionEnd > part.start,
      );
      if (overlapped.length > 0) {
        event.preventDefault();
        deleteSelectionRange(selectionStart, selectionEnd, overlapped.map((part) => part.mention));
        return true;
      }
    }

    const targetPart = mentionRanges.find((part) =>
      event.key === 'Backspace'
        ? selectionStart > part.start && selectionStart <= part.end
        : selectionStart >= part.start && selectionStart < part.end,
    );
    if (targetPart) {
      event.preventDefault();
      removeMention(targetPart.mention.path, targetPart.start, getMentionBoundaryEnd(value, targetPart));
      return true;
    }

    if (event.key === 'Backspace') {
      const trailingSpacePart = mentionRanges.find((part) =>
        selectionStart === part.end + 1 &&
        selectionEnd === selectionStart &&
        value[part.end] === ' ',
      );
      if (trailingSpacePart) {
        event.preventDefault();
        removeMention(trailingSpacePart.mention.path, trailingSpacePart.start, trailingSpacePart.end + 1);
        return true;
      }
    }
  }

  const isPlainHorizontalArrow =
    !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;

  if (isPlainHorizontalArrow && selectionStart === selectionEnd && event.key === 'ArrowLeft') {
    const targetPart = mentionRanges.find((part) =>
      selectionStart > part.start && selectionStart <= getMentionBoundaryEnd(value, part)
    );
    if (targetPart) {
      event.preventDefault();
      setTextareaCaretIndex(targetPart.start);
      return true;
    }
  }

  if (isPlainHorizontalArrow && selectionStart === selectionEnd && event.key === 'ArrowRight') {
    const targetPart = mentionRanges.find((part) =>
      selectionStart >= part.start && selectionStart < getMentionBoundaryEnd(value, part)
    );
    if (targetPart) {
      event.preventDefault();
      setTextareaCaretIndex(getMentionBoundaryEnd(value, targetPart));
      return true;
    }
  }

  if (removeLastMentionOnBoundary && event.key === 'Backspace' && mentions.length > 0 && selectionStart === 0 && selectionEnd === 0) {
    event.preventDefault();
    const lastMention = mentions[mentions.length - 1];
    if (lastMention) {
      removeMention(lastMention.path);
    }
    return true;
  }

  if (!showMentionPicker) return false;

  if (event.key === 'Escape') {
    event.preventDefault();
    setCaretIndex(-1);
    return true;
  }

  if (filteredCandidates.length === 0) return false;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setActiveMentionIndex((prev) => (prev + 1) % filteredCandidates.length);
    return true;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    setActiveMentionIndex((prev) =>
      prev - 1 < 0 ? filteredCandidates.length - 1 : prev - 1,
    );
    return true;
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    const candidate = filteredCandidates[activeMentionIndex] ?? filteredCandidates[0];
    if (candidate) {
      applyMentionCandidate(candidate);
      return true;
    }
  }

  return false;
}
