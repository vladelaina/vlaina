import { useEffect, useRef } from 'react';

interface Size {
  width: number;
  height: number;
}

interface UseStableCoverContainerSizeOptions {
  effectiveContainerSize: Size | null;
  freeze: boolean;
}

export function useStableCoverContainerSize({
  effectiveContainerSize,
  freeze,
}: UseStableCoverContainerSizeOptions) {
  const stableContainerSizeRef = useRef<Size | null>(null);

  useEffect(() => {
    if (!effectiveContainerSize) {
      stableContainerSizeRef.current = null;
      return;
    }

    if (!freeze) {
      stableContainerSizeRef.current = effectiveContainerSize;
    }
  }, [effectiveContainerSize, freeze]);

  return freeze
    ? (stableContainerSizeRef.current ?? effectiveContainerSize)
    : effectiveContainerSize;
}
