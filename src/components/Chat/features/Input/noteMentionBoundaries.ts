export function isMentionWordCharacter(value: string): boolean {
  return /^[\p{L}\p{N}_]$/u.test(value);
}

export function hasMentionStartBoundary(value: string, index: number): boolean {
  if (index === 0) {
    return true;
  }
  return !isMentionWordCharacter(value[index - 1] ?? '');
}

export function hasMentionEndBoundary(value: string, end: number): boolean {
  return end === value.length || !isMentionWordCharacter(value[end] ?? '');
}
