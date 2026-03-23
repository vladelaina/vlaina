const MAX_CACHE_SIZE = 50;
const dimensionCache = new Map<string, { width: number; height: number }>();

export function getCachedDimensions(src: string) {
  return dimensionCache.get(src);
}

export async function loadImageWithDimensions(src: string): Promise<{ width: number; height: number } | null> {
  const cached = dimensionCache.get(src);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };

      if (dimensionCache.size >= MAX_CACHE_SIZE) {
        const firstKey = dimensionCache.keys().next().value;
        if (firstKey) dimensionCache.delete(firstKey);
      }

      dimensionCache.set(src, dims);
      resolve(dims);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
