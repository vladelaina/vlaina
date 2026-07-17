import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useImageMediaLifecycle } from './useImageMediaLifecycle';

const mediaSize = {
    width: 100,
    height: 50,
    naturalWidth: 100,
    naturalHeight: 50,
};

function renderLifecycleHook(nodeSrc: string) {
    const setWidth = vi.fn();
    const setCaptionInput = vi.fn();
    const setNaturalRatio = vi.fn();
    const setIsReady = vi.fn();
    const updateNodeAttrs = vi.fn();

    const hook = renderHook(() => useImageMediaLifecycle({
        width: '50%',
        nodeSrc,
        nodeAlt: '',
        containerRef: { current: null },
        setWidth,
        setCaptionInput,
        setNaturalRatio,
        setIsReady,
        updateNodeAttrs,
    }));

    return {
        ...hook,
        setCaptionInput,
        setIsReady,
        setNaturalRatio,
        setWidth,
        updateNodeAttrs,
    };
}

describe('useImageMediaLifecycle', () => {
    it('generates captions from short decoded image filenames', () => {
        const hook = renderLifecycleHook('assets/demo%20image.png');

        act(() => {
            hook.result.current.onMediaLoaded(mediaSize);
        });

        expect(hook.setNaturalRatio).toHaveBeenCalledWith(2);
        expect(hook.setCaptionInput).toHaveBeenCalledWith('demo image');
        expect(hook.updateNodeAttrs).toHaveBeenCalledWith({ alt: 'demo image' });
        expect(hook.setWidth).not.toHaveBeenCalled();
        expect(hook.setIsReady).toHaveBeenCalledWith(true);
    });

    it('does not generate captions from oversized image sources', () => {
        const hook = renderLifecycleHook(`assets/${'a'.repeat(4100)}.png`);

        act(() => {
            hook.result.current.onMediaLoaded(mediaSize);
        });

        expect(hook.setCaptionInput).not.toHaveBeenCalled();
        expect(hook.updateNodeAttrs).not.toHaveBeenCalled();
        expect(hook.setIsReady).toHaveBeenCalledWith(true);
    });

    it('persists initial width and generated alt in one node update', () => {
        const parentElement = document.createElement('div');
        Object.defineProperty(parentElement, 'offsetWidth', { value: 400 });
        const container = document.createElement('div');
        parentElement.appendChild(container);
        const updateNodeAttrs = vi.fn();
        const setWidth = vi.fn();
        const setCaptionInput = vi.fn();
        const hook = renderHook(() => useImageMediaLifecycle({
            width: 'auto',
            nodeSrc: 'assets/demo.png',
            nodeAlt: '',
            containerRef: { current: container },
            setWidth,
            setCaptionInput,
            setNaturalRatio: vi.fn(),
            setIsReady: vi.fn(),
            updateNodeAttrs,
        }));

        act(() => {
            hook.result.current.onMediaLoaded(mediaSize);
        });

        expect(updateNodeAttrs).toHaveBeenCalledTimes(1);
        expect(updateNodeAttrs).toHaveBeenCalledWith({
            width: '25%',
            alt: 'demo',
        });
    });
});
