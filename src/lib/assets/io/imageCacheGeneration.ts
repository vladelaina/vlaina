let imageCacheGeneration = 0;
const imageCacheGenerationListeners = new Set<() => void>();

export function getImageCacheGeneration(): number {
  return imageCacheGeneration;
}

export function incrementImageCacheGeneration(): void {
  imageCacheGeneration += 1;
  for (const listener of imageCacheGenerationListeners) listener();
}

export function subscribeImageCacheGeneration(listener: () => void): () => void {
  imageCacheGenerationListeners.add(listener);
  return () => imageCacheGenerationListeners.delete(listener);
}
