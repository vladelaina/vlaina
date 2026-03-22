import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCoverInteractionHandlers } from './useCoverInteractionHandlers';

function createProps(overrides?: Partial<Parameters<typeof useCoverInteractionHandlers>[0]>) {
  return {
    readOnly: false,
    cachedBounds: { maxTranslateX: 100, maxTranslateY: 100 },
    clampCropForZoom: vi.fn((crop) => crop),
    effectiveMinZoom: 1,
    setCrop: vi.fn(),
    setZoom: vi.fn(),
    setIsInteracting: vi.fn(),
    showPicker: false,
    setShowPicker: vi.fn(),
    crop: { x: 0, y: 0 },
    zoom: 1,
    saveToDb: vi.fn(),
    ignoreCropSyncRef: { current: false },
    ...overrides,
  };
}

describe('useCoverInteractionHandlers', () => {
  it('toggles picker on click when no drag happens', () => {
    const props = createProps();
    const { result } = renderHook((nextProps) => useCoverInteractionHandlers(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.markPointerIntent();
      result.current.handleInteractionStart();
      result.current.handleInteractionEnd();
    });

    expect(props.setIsInteracting).toHaveBeenNthCalledWith(1, true);
    expect(props.setIsInteracting).toHaveBeenNthCalledWith(2, false);
    expect(props.setShowPicker).toHaveBeenCalledWith(true);
    expect(props.saveToDb).not.toHaveBeenCalled();
    expect(props.ignoreCropSyncRef.current).toBe(false);
  });

  it('persists crop on drag commit instead of toggling picker', () => {
    const props = createProps();
    const { result, rerender } = renderHook((nextProps) => useCoverInteractionHandlers(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.markPointerIntent();
      result.current.handleInteractionStart();
      result.current.onCropperCropChange({ x: 0, y: 20 });
    });

    expect(props.setCrop).toHaveBeenCalledWith({ x: 0, y: 20 });

    rerender({
      ...props,
      crop: { x: 0, y: 20 },
    });

    act(() => {
      result.current.handleInteractionEnd();
    });

    expect(props.saveToDb).toHaveBeenCalledWith({ x: 0, y: 20 }, 1);
    expect(props.setShowPicker).not.toHaveBeenCalled();
    expect(props.ignoreCropSyncRef.current).toBe(true);
  });

  it('keeps crop and zoom interaction available while picker is open', () => {
    const props = createProps({
      showPicker: true,
    });
    const { result } = renderHook((nextProps) => useCoverInteractionHandlers(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.onCropperCropChange({ x: 12, y: -18 });
      result.current.onCropperZoomChange(1.5);
    });

    expect(props.setCrop).toHaveBeenCalledWith({ x: 12, y: -18 });
    expect(props.setZoom).toHaveBeenCalledWith(1.5);
  });

  it('clamps crop immediately when zoom would expose blank edges', () => {
    const props = createProps({
      crop: { x: 80, y: 70 },
      clampCropForZoom: vi.fn(() => ({ x: 40, y: 25 })),
    });
    const { result } = renderHook((nextProps) => useCoverInteractionHandlers(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.markNonPointerIntent();
      result.current.handleInteractionStart();
      result.current.onCropperZoomChange(1.2);
    });

    expect(props.clampCropForZoom).toHaveBeenCalledWith({ x: 80, y: 70 }, 1.2);
    expect(props.setCrop).toHaveBeenCalledWith({ x: 40, y: 25 });
    expect(props.setZoom).toHaveBeenCalledWith(1.2);
  });

  it('does not toggle picker for non-pointer interaction without changes', () => {
    const props = createProps();
    const { result } = renderHook((nextProps) => useCoverInteractionHandlers(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.markNonPointerIntent();
      result.current.handleInteractionStart();
      result.current.handleInteractionEnd();
    });

    expect(props.setShowPicker).not.toHaveBeenCalled();
    expect(props.saveToDb).not.toHaveBeenCalled();
  });

  it('persists small non-pointer movement instead of toggling picker', () => {
    const props = createProps();
    const { result, rerender } = renderHook((nextProps) => useCoverInteractionHandlers(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.markNonPointerIntent();
      result.current.handleInteractionStart();
      result.current.onCropperCropChange({ x: 2, y: 0 });
    });

    rerender({
      ...props,
      crop: { x: 2, y: 0 },
    });

    act(() => {
      result.current.handleInteractionEnd();
    });

    expect(props.saveToDb).toHaveBeenCalledWith({ x: 2, y: 0 }, 1);
    expect(props.setShowPicker).not.toHaveBeenCalled();
    expect(props.ignoreCropSyncRef.current).toBe(true);
  });

  it('persists the latest zoom at interaction end without requiring rerender first', () => {
    const props = createProps();
    const { result } = renderHook((nextProps) => useCoverInteractionHandlers(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.markNonPointerIntent();
      result.current.handleInteractionStart();
      result.current.onCropperZoomChange(1.5);
      result.current.handleInteractionEnd();
    });

    expect(props.setZoom).toHaveBeenCalledWith(1.5);
    expect(props.saveToDb).toHaveBeenCalledWith({ x: 0, y: 0 }, 1.5);
    expect(props.setShowPicker).not.toHaveBeenCalled();
    expect(props.ignoreCropSyncRef.current).toBe(true);
  });

  it('does not open picker when pointer moved but crop is clamped', () => {
    const props = createProps();
    const { result } = renderHook((nextProps) => useCoverInteractionHandlers(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.markPointerIntent(100, 100);
      result.current.handleInteractionStart();
      result.current.markPointerMoveIntent(100, 112);
      result.current.handleInteractionEnd();
    });

    expect(props.setShowPicker).not.toHaveBeenCalled();
    expect(props.saveToDb).not.toHaveBeenCalled();
    expect(props.ignoreCropSyncRef.current).toBe(false);
  });
});
