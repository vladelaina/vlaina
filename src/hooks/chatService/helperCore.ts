export function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

export function resolveAssistantContent(
  returnedContent: string,
  lastStreamedContent: string,
  applyResolvedContent: (content: string) => void,
  createEmptyResponseError: () => Error = () => new Error('The model returned an empty response.'),
) {
  const finalContent = returnedContent || lastStreamedContent;

  if (returnedContent && returnedContent !== lastStreamedContent) {
    applyResolvedContent(returnedContent);
  }

  if (!finalContent.trim()) {
    throw createEmptyResponseError();
  }

  return finalContent;
}
