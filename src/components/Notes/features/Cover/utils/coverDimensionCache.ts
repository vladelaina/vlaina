const MAX_CACHE_SIZE = 50;
export const MAX_PENDING_COVER_DIMENSION_LOADS = 50;
const dimensionCache = new Map<string, { width: number; height: number }>();
const dimensionLoadPromises = new Map<string, Promise<{ width: number; height: number } | null>>();

export function getCachedDimensions(src: string) {
  return dimensionCache.get(src);
}

export function clearCoverDimensionCache(): void {
  dimensionCache.clear();
  dimensionLoadPromises.clear();
}

export async function loadImageWithDimensions(src: string): Promise<{ width: number; height: number } | null> {
  const cached = dimensionCache.get(src);
  if (cached) return cached;

  const existingLoad = dimensionLoadPromises.get(src);
  if (existingLoad) return existingLoad;
  if (dimensionLoadPromises.size >= MAX_PENDING_COVER_DIMENSION_LOADS) {
    return null;
  }

  const loadPromise = new Promise<{ width: number; height: number } | null>((resolve) => {
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

  dimensionLoadPromises.set(src, loadPromise);
  try {
    return await loadPromise;
  } finally {
    if (dimensionLoadPromises.get(src) === loadPromise) {
      dimensionLoadPromises.delete(src);
    }
  }
}
