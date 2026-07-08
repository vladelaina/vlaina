export function getNextWhiteboardIdSequence(items: { id: string }[], prefix: string): number {
  let maxSequence = 0;
  for (const item of items) {
    if (!item.id.startsWith(prefix)) continue;
    const suffix = item.id.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    maxSequence = Math.max(maxSequence, Number.parseInt(suffix, 10));
  }
  return maxSequence + 1;
}
