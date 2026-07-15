import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { WhiteboardEraserSample } from '../model/whiteboardEraser';
import type { WhiteboardStroke } from '../model/whiteboardModel';
import { eraseWhiteboardStrokes } from '../model/whiteboardStrokeEraser';

interface WhiteboardStrokeEraserGestureOptions {
  pushHistory: () => void;
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>;
  strokes: WhiteboardStroke[];
}

export function useWhiteboardStrokeEraserGesture({
  pushHistory,
  setStrokes,
  strokes,
}: WhiteboardStrokeEraserGestureOptions) {
  const [preview, setPreview] = useState<WhiteboardStroke[] | null>(null);
  const changedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const lastSampleRef = useRef<WhiteboardEraserSample | null>(null);
  const pendingSamplesRef = useRef<WhiteboardEraserSample[]>([]);
  const workingStrokesRef = useRef<WhiteboardStroke[]>([]);

  const applyPendingSamples = useCallback(() => {
    const pending = pendingSamplesRef.current;
    pendingSamplesRef.current = [];
    if (pending.length === 0) return;
    const samples = lastSampleRef.current ? [lastSampleRef.current, ...pending] : pending;
    lastSampleRef.current = pending.at(-1) ?? lastSampleRef.current;
    const next = eraseWhiteboardStrokes(workingStrokesRef.current, samples);
    if (next === workingStrokesRef.current) return;
    changedRef.current = true;
    workingStrokesRef.current = next;
    setPreview(next);
  }, []);

  const publishPendingSamples = useCallback(() => {
    frameRef.current = null;
    applyPendingSamples();
  }, [applyPendingSamples]);

  const update = useCallback((samples: WhiteboardEraserSample[]) => {
    pendingSamplesRef.current.push(...samples);
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(publishPendingSamples);
  }, [publishPendingSamples]);

  const reset = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    changedRef.current = false;
    frameRef.current = null;
    lastSampleRef.current = null;
    pendingSamplesRef.current = [];
    workingStrokesRef.current = [];
    setPreview(null);
  }, []);

  const begin = useCallback((samples: WhiteboardEraserSample[]) => {
    reset();
    workingStrokesRef.current = strokes;
    update(samples);
  }, [reset, strokes, update]);

  const finish = useCallback((cancelled = false) => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    applyPendingSamples();
    if (!cancelled && changedRef.current) {
      pushHistory();
      setStrokes(workingStrokesRef.current);
    }
    reset();
  }, [applyPendingSamples, pushHistory, reset, setStrokes]);

  useEffect(() => reset, [reset]);

  return { begin, finish, preview, update };
}
