const MAX_NOTE_LABEL_LENGTH = 19;
const NOTE_LABEL_ELLIPSIS = '....';

export function truncateNoteLabel(label: string): string {
  if (label.length < MAX_NOTE_LABEL_LENGTH) {
    return label;
  }

  return `${label.slice(0, MAX_NOTE_LABEL_LENGTH - NOTE_LABEL_ELLIPSIS.length)}${NOTE_LABEL_ELLIPSIS}`;
}
