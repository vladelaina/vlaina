const NOTE_LABEL_VISIBLE_CHARACTERS = 15;
const NOTE_LABEL_ELLIPSIS = '....';

export function truncateNoteLabel(label: string): string {
  const characters = Array.from(label);
  if (characters.length <= NOTE_LABEL_VISIBLE_CHARACTERS) {
    return label;
  }

  return `${characters.slice(0, NOTE_LABEL_VISIBLE_CHARACTERS).join('')}${NOTE_LABEL_ELLIPSIS}`;
}
