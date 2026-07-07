export function logE2EMilkdownTiming(label: string, detail: Record<string, unknown>): void {
  if (
    typeof window === 'undefined' ||
    !(window as { __vlainaE2E?: unknown }).__vlainaE2E
  ) {
    return;
  }

  console.info(`[notes-milkdown-timing:${label}]`, {
    ...detail,
    atMs: Math.round(performance.now()),
  });
}
