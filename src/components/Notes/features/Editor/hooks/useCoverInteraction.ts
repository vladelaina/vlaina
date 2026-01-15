import { useState, useRef, useEffect, useCallback, useMemo, RefObject } from 'react';
import {
    MIN_HEIGHT, MAX_HEIGHT, DEFAULT_HEIGHT,
    MIN_SCALE, MAX_SCALE,
    DRAG_THRESHOLD, SAVE_DEBOUNCE_MS,
    calcImageDimensions
} from './coverUtils';

interface UseCoverInteractionProps {
    url: string | null;
    positionX: number;
    positionY: number;
    height?: number;
    scale?: number;
    readOnly?: boolean;
    onUpdate: (url: string | null, x: number, y: number, h?: number, s?: number) => void;
    containerRef: RefObject<HTMLDivElement | null>;
    imgRef: RefObject<HTMLImageElement | null>;
    cachedDimensionsRef: RefObject<{ width: number; height: number } | null>;
    isImageReady: boolean;
}

export function useCoverInteraction({
    url, positionX, positionY, height, scale = 1, readOnly, onUpdate,
    containerRef, imgRef, cachedDimensionsRef, isImageReady
}: UseCoverInteractionProps) {
    // Local State
    const [dragX, setDragX] = useState(positionX);
    const [dragY, setDragY] = useState(positionY);
    const [currentScale, setCurrentScale] = useState(scale);
    const [coverHeight, setCoverHeight] = useState(height ?? DEFAULT_HEIGHT);
    const [isAnimating, setIsAnimating] = useState(false);
    const [containerWidth, setContainerWidth] = useState(720);
    const [isResizingHeight, setIsResizingHeight] = useState(false);

    // Refs for stale closures
    const currentXRef = useRef(positionX);
    const currentYRef = useRef(positionY);
    const currentScaleRef = useRef(scale);
    const currentHeightRef = useRef(height ?? DEFAULT_HEIGHT);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0, height: 0 });
    const hasDraggedRef = useRef(false);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync Props
    useEffect(() => {
        currentXRef.current = positionX;
        currentYRef.current = positionY;
        currentScaleRef.current = scale;
        setDragX(positionX);
        setDragY(positionY);
        setCurrentScale(scale);
        if (height !== undefined) {
            setCoverHeight(height);
            currentHeightRef.current = height;
        }
    }, [positionX, positionY, scale, height]);

    // ResizeObserver
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        let rafId: number | null = null;

        const resizeObserver = new ResizeObserver((entries) => {
            if (rafId !== null) return;
            rafId = requestAnimationFrame(() => {
                for (const entry of entries) {
                    if (entry.contentRect.width > 0) {
                        setContainerWidth(entry.contentRect.width);
                    }
                }
                rafId = null;
            });
        });

        resizeObserver.observe(container);
        return () => {
            resizeObserver.disconnect();
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, []);

    // Debounced Save
    const debouncedSave = useCallback((newScale?: number) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            onUpdate(
                url,
                currentXRef.current,
                currentYRef.current,
                currentHeightRef.current,
                newScale ?? currentScaleRef.current
            );
            setIsAnimating(false);
        }, SAVE_DEBOUNCE_MS);
    }, [url, onUpdate]);

    // --- Drag Logic ---
    const imageRafRef = useRef<number | null>(null);
    const pendingDragPos = useRef<{ x: number; y: number } | null>(null);

    const handleImageMouseMove = useCallback((e: globalThis.MouseEvent) => {
        const container = containerRef.current;
        const img = imgRef.current;
        if (!container || !img?.naturalWidth) return;
        e.preventDefault();

        const deltaX = e.clientX - dragStartRef.current.mouseX;
        const deltaY = e.clientY - dragStartRef.current.mouseY;

        if (!hasDraggedRef.current && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
            hasDraggedRef.current = true;
            setIsAnimating(false);
            document.body.style.cursor = 'move';
        }
        if (!hasDraggedRef.current) return;

        const { overflowX, overflowY } = calcImageDimensions(
            container.clientWidth, container.clientHeight,
            img.naturalWidth, img.naturalHeight,
            currentScaleRef.current
        );

        const newX = overflowX > 0
            ? Math.max(0, Math.min(100, dragStartRef.current.posX - (deltaX / overflowX) * 100))
            : 50;
        const newY = overflowY > 0
            ? Math.max(0, Math.min(100, dragStartRef.current.posY - (deltaY / overflowY) * 100))
            : 50;

        pendingDragPos.current = { x: newX, y: newY };

        if (imageRafRef.current === null) {
            imageRafRef.current = requestAnimationFrame(() => {
                if (pendingDragPos.current !== null) {
                    currentXRef.current = pendingDragPos.current.x;
                    currentYRef.current = pendingDragPos.current.y;
                    setDragX(pendingDragPos.current.x);
                    setDragY(pendingDragPos.current.y);
                    pendingDragPos.current = null;
                }
                imageRafRef.current = null;
            });
        }
    }, [containerRef, imgRef]);

    const handleImageMouseUp = useCallback((onOpenPicker?: () => void) => {
        document.removeEventListener('mousemove', handleImageMouseMove);
        // We need to bind the exact same function instance to remove it
        // But since we use a wrapper in effect, we handle cleanup there or rely on stable identity
        // Here we rely on the component using a stable wrapper or directly calling this
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        if (pendingDragPos.current !== null) {
            currentXRef.current = pendingDragPos.current.x;
            currentYRef.current = pendingDragPos.current.y;
            setDragX(pendingDragPos.current.x);
            setDragY(pendingDragPos.current.y);
            pendingDragPos.current = null;
        }

        if (imageRafRef.current !== null) {
            cancelAnimationFrame(imageRafRef.current);
            imageRafRef.current = null;
        }

        if (hasDraggedRef.current) {
            debouncedSave();
        } else if (onOpenPicker) {
            onOpenPicker();
        }
    }, [handleImageMouseMove, debouncedSave]);

    // Generic Mouse Down Handler
    const handleImageMouseDown = useCallback((e: React.MouseEvent, openPickerCallback?: () => void) => {
        if (readOnly) return;
        e.preventDefault();
        hasDraggedRef.current = false;
        dragStartRef.current = {
            mouseX: e.clientX, mouseY: e.clientY,
            posX: currentXRef.current, posY: currentYRef.current,
            height: 0
        };
        document.body.style.userSelect = 'none';

        const onUp = () => {
            handleImageMouseUp(openPickerCallback);
            document.removeEventListener('mouseup', onUp);
            // Also remove move listener
            document.removeEventListener('mousemove', handleImageMouseMove);
        };
        document.addEventListener('mousemove', handleImageMouseMove);
        document.addEventListener('mouseup', onUp);
    }, [readOnly, handleImageMouseUp, handleImageMouseMove]);


    // --- Wheel Logic ---
    useEffect(() => {
        const container = containerRef.current;
        if (!container || readOnly || !url) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (!imgRef.current?.naturalWidth) return;

            const isFast = e.ctrlKey || e.metaKey;
            const step = isFast ? 0.15 : 0.03;
            const delta = -Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 100) / 100 * step;

            const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentScaleRef.current + delta));
            if (newScale === currentScaleRef.current) return;

            currentScaleRef.current = newScale;
            setCurrentScale(newScale);
            setIsAnimating(true);
            debouncedSave(newScale);
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [readOnly, url, debouncedSave]);

    // --- Resize Logic ---
    const resizeRafRef = useRef<number | null>(null);
    const pendingHeight = useRef<number | null>(null);

    const handleResizeMouseMove = useCallback((e: globalThis.MouseEvent) => {
        e.preventDefault();
        const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragStartRef.current.height + e.clientY - dragStartRef.current.mouseY));
        pendingHeight.current = newHeight;

        if (resizeRafRef.current === null) {
            resizeRafRef.current = requestAnimationFrame(() => {
                if (pendingHeight.current !== null) {
                    currentHeightRef.current = pendingHeight.current;
                    setCoverHeight(pendingHeight.current);
                    pendingHeight.current = null;
                }
                resizeRafRef.current = null;
            });
        }
    }, []);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        if (readOnly || !url) return;
        e.preventDefault();
        e.stopPropagation();
        dragStartRef.current.mouseY = e.clientY;
        dragStartRef.current.height = coverHeight;
        setIsAnimating(false);
        setIsResizingHeight(true);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';

        const onUp = () => {
            document.removeEventListener('mousemove', handleResizeMouseMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            if (pendingHeight.current !== null) {
                currentHeightRef.current = pendingHeight.current;
                setCoverHeight(pendingHeight.current);
                pendingHeight.current = null;
            }
            if (resizeRafRef.current !== null) {
                cancelAnimationFrame(resizeRafRef.current);
                resizeRafRef.current = null;
            }

            // Trigger update
            onUpdate(url, currentXRef.current, currentYRef.current, currentHeightRef.current, currentScaleRef.current);
            setIsResizingHeight(false);
        };

        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', onUp);
    }, [readOnly, url, coverHeight, handleResizeMouseMove, onUpdate]);

    // Compute Style
    const imageStyle = useMemo((): React.CSSProperties => {
        const containerW = containerWidth;
        const containerH = coverHeight;
        const imgW = imgRef.current?.naturalWidth || cachedDimensionsRef.current?.width;
        const imgH = imgRef.current?.naturalHeight || cachedDimensionsRef.current?.height;

        if (!imgW || !imgH) {
            return { width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${dragX}% ${dragY}%` };
        }

        const { width, height, overflowX, overflowY } = calcImageDimensions(containerW, containerH, imgW, imgH, currentScale);
        const topOffset = -(overflowY * dragY / 100);

        return {
            position: 'absolute',
            width, height,
            left: -(overflowX * dragX / 100),
            top: topOffset,
            maxWidth: 'none',
            maxHeight: 'none',
            objectFit: 'cover',
        };
    }, [dragX, dragY, currentScale, coverHeight, containerWidth, cachedDimensionsRef, isImageReady]);

    return {
        dragX, dragY, currentScale, coverHeight,
        isAnimating, isResizingHeight,
        setCoverHeight,
        handleImageMouseDown,
        handleResizeMouseDown,
        imageStyle,
        currentHeightRef,
        currentScaleRef
    };
}
