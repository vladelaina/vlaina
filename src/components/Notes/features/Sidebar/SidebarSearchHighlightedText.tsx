function normalizeSearchTextWithOffsets(value: string): {
  text: string;
  startOffsets: number[];
  endOffsets: number[];
} {
  let text = '';
  const startOffsets: number[] = [];
  const endOffsets: number[] = [0];

  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index);
    const source = codePoint === undefined ? value[index] : String.fromCodePoint(codePoint);
    const sourceLength = source.length;
    const sourceEnd = index + sourceLength;
    const normalized = source.toLocaleLowerCase();
    const normalizedStart = text.length;

    for (let offset = 0; offset < normalized.length; offset += 1) {
      startOffsets[normalizedStart + offset] = index;
      endOffsets[normalizedStart + offset + 1] = sourceEnd;
    }

    text += normalized;
    index = sourceEnd;
  }

  startOffsets[text.length] = value.length;
  endOffsets[text.length] = value.length;

  return { text, startOffsets, endOffsets };
}

export function HighlightedSearchText({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return <span className={className}>{text}</span>;
  }

  const normalizedText = normalizeSearchTextWithOffsets(text);
  const lowerText = normalizedText.text;
  const lowerQuery = trimmedQuery.toLocaleLowerCase();
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;
  let normalizedCursor = 0;

  while (normalizedCursor < lowerText.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, normalizedCursor);
    if (matchIndex === -1) {
      parts.push({ text: text.slice(cursor), highlighted: false });
      break;
    }

    const sourceStart = normalizedText.startOffsets[matchIndex] ?? cursor;
    const sourceEnd = normalizedText.endOffsets[matchIndex + lowerQuery.length] ?? text.length;

    if (sourceStart > cursor) {
      parts.push({ text: text.slice(cursor, sourceStart), highlighted: false });
    }

    parts.push({
      text: text.slice(sourceStart, sourceEnd),
      highlighted: true,
    });
    cursor = sourceEnd;
    normalizedCursor = matchIndex + Math.max(lowerQuery.length, 1);
  }

  return (
    <span className={className}>
      {parts.map((part, index) => (
        <span
          key={`${part.text}-${index}`}
          className={part.highlighted ? 'text-[var(--vlaina-color-status-info-fg)]' : undefined}
        >
          {part.text}
        </span>
      ))}
    </span>
  );
}
