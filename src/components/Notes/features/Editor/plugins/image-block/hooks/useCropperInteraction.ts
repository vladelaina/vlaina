import { useState, useRef, useEffect, useCallback } from 'react';
import type { Area } from 'react-easy-crop';
import type { CropParams } from '../utils/imageSourceFragment';
import type { CropArea } from '../types';

const AUTO_SAVE_DELAY_MS = 500;
const MAX_ZOOM = 5;

interface UseCropperInteractionProps {
    isActive: boolean;
    containerRef: React.RefObject<HTMLDivElement | null>;
    minZoomLimit: number;
    setZoom: (z: number | ((prev: number) => number)) => void;
    setCrop: (c: { x: number; y: number }) => void;
    onSave: (percentageCrop: CropArea, ratio: number) => void;
    onCancel: () => void;
    initialCropParams: CropParams | null;
    containerSize: { width: number; height: number };
    originalAspectRatioRef: React.MutableRefObject<number>;
}

export function useCropperInteraction({
    isActive,
    containerRef,
    minZoomLimit,
    setZoom,
    setCrop,
    onSave,
    onCancel,
    initialCropParams,
    containerSize,
    originalAspectRatioRef
}: UseCropperInteractionProps) {
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const lastPercentageCrop = useRef<CropArea | null>(null);
    const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, []);

    const performSave = useCallback(() => {
        if (lastPercentageCrop.current) {
            const pc = lastPercentageCrop.current;
            let currentRatio = initialCropParams?.ratio;

            if (!currentRatio && containerSize.width && containerSize.height) {
                currentRatio = containerSize.width / containerSize.height;
            }

            if (!currentRatio) {
                currentRatio = (pc.width / pc.height) * originalAspectRatioRef.current;
            }

            onSave(pc, currentRatio);
        }
    }, [initialCropParams?.ratio, containerSize.width, containerSize.height, onSave, originalAspectRatioRef]);

    useEffect(() => {
        const currentRef = containerRef.current;
        if (!currentRef) return;

        const onWheel = (e: WheelEvent) => {
            if (isActive) return;

            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();

                const delta = -e.deltaY / 200;
                setZoom(prevZoom => Math.min(MAX_ZOOM, Math.max(minZoomLimit, prevZoom + delta)));

                if (autoSaveTimeoutRef.current) {
                    clearTimeout(autoSaveTimeoutRef.current);
                }

                autoSaveTimeoutRef.current = setTimeout(() => {
                    performSave();
                }, AUTO_SAVE_DELAY_MS);
            }
        };

        currentRef.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            currentRef.removeEventListener('wheel', onWheel);
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
                autoSaveTimeoutRef.current = null;
            }
        };
    }, [isActive, minZoomLimit, performSave, setZoom, containerRef]);

    const handleInteractionEnd = () => {
        if (!isActive) {
            performSave();
        }
    };

    const onCropChangeComplete = useCallback((percentageCrop: Area) => {
        lastPercentageCrop.current = percentageCrop;
    }, []);

    const handleCancelClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (initialCropParams) {
            const restoredZoom = 100 / initialCropParams.width;
            setZoom(restoredZoom);
        } else {
            setZoom(minZoomLimit);
            setCrop({ x: 0, y: 0 });
        }
        onCancel();
    };

    const handleSaveClick = (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();

        const pc = lastPercentageCrop.current || { x: 0, y: 0, width: 100, height: 100 };
        const cropRatio = (pc.width / pc.height) * originalAspectRatioRef.current;
        onSave(pc, cropRatio);
    };

    return {
        isCtrlPressed,
        handleInteractionEnd,
        onCropChangeComplete,
        handleCancelClick,
        handleSaveClick
    };
}
