import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CropParams } from '../utils/imageSourceFragment';
import { useCropperState } from './useCropperState';
import { resolveCoverZoom } from '../utils/cropperViewport';

const mediaSize = {
    width: 0,
    height: 0,
    naturalWidth: 170,
    naturalHeight: 141,
};

describe('useCropperState', () => {
    it('re-fits uncropped images when the container shrinks after first load', () => {
        const { result, rerender } = renderHook(
            ({ containerSize }) => useCropperState({
                initialCropParams: null,
                containerSize,
            }),
            {
                initialProps: {
                    containerSize: { width: 500, height: 500 },
                },
            },
        );

        act(() => {
            result.current.onMediaLoaded(mediaSize);
        });

        expect(result.current.zoom).toBeCloseTo(
            resolveCoverZoom({ width: 500, height: 500 }, { width: 170, height: 141 })!,
            6,
        );

        rerender({ containerSize: { width: 170, height: 141 } });

        expect(result.current.zoom).toBeCloseTo(
            resolveCoverZoom({ width: 170, height: 141 }, { width: 170, height: 141 })!,
            6,
        );
        expect(result.current.crop).toEqual({ x: 0, y: 0 });
    });

    it('keeps restored crop state when crop params are present', () => {
        const initialCropParams: CropParams = {
            x: 10,
            y: 20,
            width: 40,
            height: 50,
            ratio: 1,
        };

        const { result, rerender } = renderHook(
            ({ containerSize }) => useCropperState({
                initialCropParams,
                containerSize,
            }),
            {
                initialProps: {
                    containerSize: { width: 500, height: 500 },
                },
            },
        );

        act(() => {
            result.current.onMediaLoaded(mediaSize);
        });

        const zoomAfterLoad = result.current.zoom;
        const cropAfterLoad = result.current.crop;

        rerender({ containerSize: { width: 170, height: 141 } });

        expect(result.current.zoom).toBe(zoomAfterLoad);
        expect(result.current.crop).toEqual(cropAfterLoad);
    });

    it('notifies parent state listeners when crop or zoom changes', () => {
        const onStateChange = vi.fn();
        const { result } = renderHook(() => useCropperState({
            initialCropParams: null,
            containerSize: { width: 170, height: 141 },
            onStateChange,
        }));

        act(() => {
            result.current.setCrop({ x: 4, y: 6 });
            result.current.setZoom(1.5);
        });

        expect(onStateChange).toHaveBeenCalledWith({ crop: { x: 4, y: 6 }, zoom: 1.5 });
    });
});
