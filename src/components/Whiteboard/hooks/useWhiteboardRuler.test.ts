import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { snapPointToRuler, useWhiteboardRuler, type WhiteboardRulerState } from './useWhiteboardRuler';

const ruler: WhiteboardRulerState = {
  angle: 0,
  visible: true,
  x: 0,
  y: 0,
};

const size = {
  height: 20,
  width: 100,
  zoom: 1,
};

describe('snapPointToRuler', () => {
  it('projects points inside the ruler body onto the nearest ruler edge', () => {
    expect(snapPointToRuler({ x: 0, y: -5 }, ruler, null, size)).toEqual({
      blocked: false,
      edge: 'top',
      point: { x: 0, y: -10 },
    });
  });

  it('keeps the active edge locked while drawing through the ruler body', () => {
    expect(snapPointToRuler({ x: 0, y: -5 }, ruler, 'bottom', size)).toEqual({
      blocked: false,
      edge: 'bottom',
      point: { x: 0, y: 10 },
    });
  });

  it('starts a new segment when entering the ruler band after freehand points', () => {
    expect(snapPointToRuler({ x: 0, y: -5 }, ruler, null, size, { hasPreviousPoint: true })).toEqual({
      blocked: false,
      breakBefore: true,
      edge: 'top',
      point: { x: 0, y: -10 },
    });
  });

  it('does not capture outside edge points beyond the initial capture distance', () => {
    expect(snapPointToRuler({ x: 0, y: -25 }, ruler, null, size, { hasPreviousPoint: true })).toEqual({
      blocked: false,
      edge: null,
      point: { x: 0, y: -25 },
    });
  });

  it('keeps a locked edge through the wider release distance', () => {
    expect(snapPointToRuler({ x: 0, y: -25 }, ruler, 'top', size)).toEqual({
      blocked: false,
      edge: 'top',
      point: { x: 0, y: -10 },
    });
  });

  it('releases points beyond the ruler band as a disconnected continuation', () => {
    expect(snapPointToRuler({ x: 0, y: 60 }, ruler, 'bottom', size)).toEqual({
      blocked: false,
      breakBefore: true,
      edge: null,
      point: { x: 0, y: 60 },
    });
  });

  it('releases points beyond the ruler length as a disconnected continuation', () => {
    expect(snapPointToRuler({ x: 80, y: -10 }, ruler, 'top', size)).toEqual({
      blocked: false,
      breakBefore: true,
      edge: null,
      point: { x: 80, y: -10 },
    });
  });
});

describe('useWhiteboardRuler', () => {
  it('disconnects a freehand segment from a ruler-guided segment in one pointer batch', () => {
    const { result } = renderHook(() => useWhiteboardRuler({
      angle: 0,
      visible: true,
      x: 0,
      y: 0,
    }));

    act(() => result.current.beginRulerStroke());
    const points = result.current.snapStrokePointsToRuler([
      { pressure: 1, x: 0, y: -80 },
      { pressure: 1, x: 0, y: -20 },
      { pressure: 1, x: 10, y: -20 },
    ], 1);

    expect(points).toEqual([
      { pressure: 1, x: 0, y: -80 },
      { breakBefore: true, pressure: 1, x: 0, y: -36 },
      { pressure: 1, x: 10, y: -36 },
    ]);
  });

  it('disconnects freehand continuation after leaving and re-entering the ruler', () => {
    const { result } = renderHook(() => useWhiteboardRuler({
      angle: 0,
      visible: true,
      x: 0,
      y: 0,
    }));

    act(() => result.current.beginRulerStroke());
    const points = result.current.snapStrokePointsToRuler([
      { pressure: 1, x: 0, y: -20 },
      { pressure: 1, x: 0, y: -80 },
      { pressure: 1, x: 10, y: -20 },
    ], 1);

    expect(points).toEqual([
      { pressure: 1, x: 0, y: -36 },
      { breakBefore: true, pressure: 1, x: 0, y: -80 },
      { breakBefore: true, pressure: 1, x: 10, y: -36 },
    ]);
  });
});
