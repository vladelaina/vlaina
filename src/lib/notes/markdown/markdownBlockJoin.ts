const LIST_ITEM_MARKER_PATTERN = /^\s*(?:[-+*]|\d+[.)])\s+(?:\[(?: |x|X)\]\s+)?/;

export function joinSerializedBlocks(blocks: readonly string[]): string {
  if (blocks.length === 0) return '';

  let joined = blocks[0] ?? '';
  for (let index = 1; index < blocks.length; index += 1) {
    const previous = blocks[index - 1] ?? '';
    const next = blocks[index] ?? '';
    const separator =
      previous.length === 0
      || next.length === 0
      || (LIST_ITEM_MARKER_PATTERN.test(previous) && LIST_ITEM_MARKER_PATTERN.test(next))
        ? '\n'
        : '\n\n';
    joined += separator + next;
  }

  if (joined.length === 0) {
    return '\n';
  }
  return joined;
}
