export function getBlockquotePrefix(depth: number): string {
  return Array.from({ length: Math.max(0, depth) }, () => '>').join(' ') + (depth > 0 ? ' ' : '');
}
