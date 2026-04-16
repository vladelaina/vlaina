import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { DEFAULT_HEIGHT } from '../../../../utils/coverConstants';

interface UseCoverStateProps {
  initialHeight?: number;
  scale?: number;
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}

export function useCoverState({
  initialHeight,
  scale = 1,
  pickerOpen,
  onPickerOpenChange
}: UseCoverStateProps) {
  const [coverHeight, setCoverHeight] = useState(initialHeight ?? DEFAULT_HEIGHT);
  const lastHeightProp = useRef(initialHeight);

  useLayoutEffect(() => {
    if (initialHeight === undefined || initialHeight === lastHeightProp.current) return;
    lastHeightProp.current = initialHeight;
    setCoverHeight(initialHeight);
  }, [initialHeight]);

  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const [mediaSize, setMediaSize] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(scale);

  const [isInteracting, setIsInteracting] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const isManualResizingRef = useRef(false);

  const [internalShowPicker, setInternalShowPicker] = useState(false);
  const showPicker = pickerOpen ?? internalShowPicker;

  const setShowPicker = useCallback((open: boolean) => {
    if (onPickerOpenChange) {
      onPickerOpenChange(open);
    } else {
      setInternalShowPicker(open);
    }
  }, [onPickerOpenChange]);

  useLayoutEffect(() => {
    const safeZoom = Math.max(scale, 1);
    setZoom((prevZoom) => {
      return Math.abs(prevZoom - safeZoom) > 0.0001 ? safeZoom : prevZoom;
    });
  }, [scale]);

  return {
    coverHeight,
    setCoverHeight,
    containerSize,
    setContainerSize,
    mediaSize,
    setMediaSize,
    crop,
    setCrop,
    zoom,
    setZoom,
    isInteracting,
    setIsInteracting,
    isResizing,
    setIsResizing,
    isManualResizingRef,
    showPicker,
    setShowPicker
  };
}
