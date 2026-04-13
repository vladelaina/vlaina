export function generateId(prefix: string): string {
  return `${prefix}${crypto.randomUUID()}`;
}
