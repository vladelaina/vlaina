import { useRef, useCallback, useEffect } from 'react';
import { useUIStore } from '@/stores/uiSlice';

export function useIconPreview(targetId: string | undefined) {
  const setUniversalPreview = useUIStore(s => s.setUniversalPreview);
  const previewRafRef = useRef<number | null>(null);
  const clearPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePreview = useCallback((icon: string | null) => {
    if (!targetId) return;

    if (clearPreviewTimerRef.current) {
      clearTimeout(clearPreviewTimerRef.current);
      clearPreviewTimerRef.current = null;
    }

    if (icon === null) {
      // Delay clearing to avoid flickering when moving between icons
      clearPreviewTimerRef.current = setTimeout(() => {
        // Only clear if we are still targeting this ID (concurrency safety)
        if (useUIStore.getState().universalPreviewTarget === targetId) {
             setUniversalPreview(null, { icon: null });
        }
      }, 80);
    } else {
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
      }
      previewRafRef.current = requestAnimationFrame(() => {
        previewRafRef.current = null;
        setUniversalPreview(targetId, { icon });
      });
    }
  }, [targetId, setUniversalPreview]);

  const handlePreviewColor = useCallback((color: string | null) => {
    if (!targetId) return;
    // Direct update for color usually fine without debounce
    setUniversalPreview(targetId, { color });
  }, [targetId, setUniversalPreview]);
  
  const handlePreviewTone = useCallback((tone: number | null) => {
      if (!targetId) return;
      setUniversalPreview(targetId, { tone });
  }, [targetId, setUniversalPreview]);

  const handlePreviewSize = useCallback((size: number | null) => {
      if (!targetId) return;
      setUniversalPreview(targetId, { size });
  }, [targetId, setUniversalPreview]);


  // Cleanup
  useEffect(() => {
    return () => {
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
      }
      if (clearPreviewTimerRef.current) {
        clearTimeout(clearPreviewTimerRef.current);
      }
      // Clear preview state on unmount if it was us
      if (useUIStore.getState().universalPreviewTarget === targetId) {
          setUniversalPreview(null, { icon: null, color: null, tone: null, size: null });
      }
    };
  }, [targetId, setUniversalPreview]);

  return {
    handlePreview,
    handlePreviewColor,
    handlePreviewTone,
    handlePreviewSize
  };
}