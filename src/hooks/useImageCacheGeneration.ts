import { useSyncExternalStore } from 'react';
import {
  getImageCacheGeneration,
  subscribeImageCacheGeneration,
} from '@/lib/assets/io/imageCacheGeneration';

export function useImageCacheGeneration(): number {
  return useSyncExternalStore(
    subscribeImageCacheGeneration,
    getImageCacheGeneration,
    getImageCacheGeneration,
  );
}
