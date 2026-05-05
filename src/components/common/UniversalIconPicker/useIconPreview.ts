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
      clearPreviewTimerRef.current = setTimeout(() => {
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

  const clearPreview = useCallback(() => {
    if (!targetId) return;

    if (previewRafRef.current !== null) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
    if (clearPreviewTimerRef.current) {
      clearTimeout(clearPreviewTimerRef.current);
      clearPreviewTimerRef.current = null;
    }
    if (useUIStore.getState().universalPreviewTarget === targetId) {
      setUniversalPreview(null, { icon: null, color: null, tone: null, size: null });
    }
  }, [targetId, setUniversalPreview]);

  useEffect(() => {
    return () => {
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
      }
      if (clearPreviewTimerRef.current) {
        clearTimeout(clearPreviewTimerRef.current);
      }
      if (useUIStore.getState().universalPreviewTarget === targetId) {
          setUniversalPreview(null, { icon: null, color: null, tone: null, size: null });
      }
    };
  }, [targetId, setUniversalPreview]);

  return {
    handlePreview,
    handlePreviewColor,
    handlePreviewTone,
    handlePreviewSize,
    clearPreview,
  };
}
