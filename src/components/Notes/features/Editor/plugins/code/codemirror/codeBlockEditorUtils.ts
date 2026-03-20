export function normalizeCodeBlockEditorText(value: string) {
  return value.replace(/\r\n?/g, '\n');
}

export function mapCodeBlockEditorOffsetToDocumentOffset(
  rawValue: string,
  normalizedOffset: number
) {
  const clampedOffset = Math.max(0, Math.min(normalizedOffset, normalizeCodeBlockEditorText(rawValue).length));
  let rawOffset = 0;
  let currentOffset = 0;

  while (rawOffset < rawValue.length && currentOffset < clampedOffset) {
    const charCode = rawValue.charCodeAt(rawOffset);
    if (charCode === 13) {
      rawOffset += rawValue.charCodeAt(rawOffset + 1) === 10 ? 2 : 1;
      currentOffset += 1;
      continue;
    }

    rawOffset += 1;
    currentOffset += 1;
  }

  return rawOffset;
}

export function mapDocumentOffsetToCodeBlockEditorOffset(
  rawValue: string,
  rawOffset: number
) {
  const clampedOffset = Math.max(0, Math.min(rawOffset, rawValue.length));
  let currentRawOffset = 0;
  let normalizedOffset = 0;

  while (currentRawOffset < clampedOffset) {
    const charCode = rawValue.charCodeAt(currentRawOffset);
    if (charCode === 13) {
      currentRawOffset += rawValue.charCodeAt(currentRawOffset + 1) === 10 ? 2 : 1;
      normalizedOffset += 1;
      continue;
    }

    currentRawOffset += 1;
    normalizedOffset += 1;
  }

  return normalizedOffset;
}

export function computeCodeBlockChange(oldValue: string, newValue: string) {
  if (oldValue === newValue) {
    return null;
  }

  let start = 0;
  let oldEnd = oldValue.length;
  let newEnd = newValue.length;

  while (start < oldEnd && start < newEnd && oldValue.charCodeAt(start) === newValue.charCodeAt(start)) {
    start += 1;
  }

  while (oldEnd > start && newEnd > start && oldValue.charCodeAt(oldEnd - 1) === newValue.charCodeAt(newEnd - 1)) {
    oldEnd -= 1;
    newEnd -= 1;
  }

  return {
    from: start,
    to: oldEnd,
    text: newValue.slice(start, newEnd),
  };
}
