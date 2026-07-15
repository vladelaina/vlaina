import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import {
  EMPTY_WHITEBOARD_ERASER_PREVIEW,
  getWhiteboardEraserTargets,
  type WhiteboardEraserPreview,
  type WhiteboardEraserSample,
} from '../model/whiteboardEraser';
import type { WhiteboardElement, WhiteboardStroke } from '../model/whiteboardModel';

interface WhiteboardEraserGestureOptions {
  elements: WhiteboardElement[];
  pushHistory: () => void;
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>;
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>;
  strokes: WhiteboardStroke[];
}

interface MutableEraserTargets {
  elementIds: Set<string>;
  strokeIds: Set<string>;
}

interface MutableEraserCandidates {
  elements: WhiteboardElement[];
  strokes: WhiteboardStroke[];
}

export function useWhiteboardEraserGesture({
  elements,
  pushHistory,
  setElements,
  setStrokes,
  strokes,
}: WhiteboardEraserGestureOptions) {
  const [preview, setPreview] = useState<WhiteboardEraserPreview>(EMPTY_WHITEBOARD_ERASER_PREVIEW);
  const frameRef = useRef<number | null>(null);
  const trailFrameRef = useRef<number | null>(null);
  const lastTrailDecayRef = useRef(0);
  const lastSampleRef = useRef<WhiteboardEraserSample | null>(null);
  const pendingSamplesRef = useRef<WhiteboardEraserSample[]>([]);
  const candidatesRef = useRef<MutableEraserCandidates>(createMutableCandidates());
  const targetsRef = useRef<MutableEraserTargets>(createMutableTargets());
  const trailRef = useRef<WhiteboardEraserSample[]>([]);

  const applyPendingSamples = useCallback(() => {
    const pending = pendingSamplesRef.current;
    pendingSamplesRef.current = [];
    if (pending.length === 0) return;
    const sweepSamples = lastSampleRef.current ? [lastSampleRef.current, ...pending] : pending;
    lastSampleRef.current = pending.at(-1) ?? lastSampleRef.current;
    const candidates = candidatesRef.current;
    const hits = getWhiteboardEraserTargets(candidates.elements, candidates.strokes, sweepSamples);
    hits.elementIds.forEach((id) => targetsRef.current.elementIds.add(id));
    hits.strokeIds.forEach((id) => targetsRef.current.strokeIds.add(id));
    if (hits.elementIds.length > 0) {
      const hitIds = new Set(hits.elementIds);
      candidates.elements = candidates.elements.filter((element) => !hitIds.has(element.id));
    }
    if (hits.strokeIds.length > 0) {
      const hitIds = new Set(hits.strokeIds);
      candidates.strokes = candidates.strokes.filter((stroke) => !hitIds.has(stroke.id));
    }
    const latestSample = pending.at(-1);
    if (latestSample) trailRef.current = [...trailRef.current, latestSample];
    setPreview({
      elementIds: [...targetsRef.current.elementIds],
      strokeIds: [...targetsRef.current.strokeIds],
      trail: trailRef.current,
    });
  }, []);

  const publishPendingSamples = useCallback(() => {
    frameRef.current = null;
    applyPendingSamples();
  }, [applyPendingSamples]);

  const update = useCallback((samples: WhiteboardEraserSample[]) => {
    pendingSamplesRef.current.push(...samples);
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(publishPendingSamples);
  }, [publishPendingSamples]);

  const decayTrail = useCallback((now: number) => {
    if (
      now - lastTrailDecayRef.current >= themeWhiteboardTokens.eraserTrailDecayIntervalMs &&
      trailRef.current.length > 1
    ) {
      const removeCount = Math.ceil(trailRef.current.length * themeWhiteboardTokens.eraserTrailDecayFraction);
      trailRef.current = trailRef.current.slice(removeCount);
      lastTrailDecayRef.current = now;
      setPreview({
        elementIds: [...targetsRef.current.elementIds],
        strokeIds: [...targetsRef.current.strokeIds],
        trail: trailRef.current,
      });
    }
    trailFrameRef.current = window.requestAnimationFrame(decayTrail);
  }, []);

  const reset = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    if (trailFrameRef.current !== null) window.cancelAnimationFrame(trailFrameRef.current);
    frameRef.current = null;
    trailFrameRef.current = null;
    lastTrailDecayRef.current = 0;
    lastSampleRef.current = null;
    pendingSamplesRef.current = [];
    candidatesRef.current = createMutableCandidates();
    targetsRef.current = createMutableTargets();
    trailRef.current = [];
    setPreview(EMPTY_WHITEBOARD_ERASER_PREVIEW);
  }, []);

  const begin = useCallback((samples: WhiteboardEraserSample[]) => {
    reset();
    candidatesRef.current = { elements, strokes };
    lastTrailDecayRef.current = performance.now();
    trailFrameRef.current = window.requestAnimationFrame(decayTrail);
    update(samples);
  }, [decayTrail, elements, reset, strokes, update]);

  const finish = useCallback((cancelled = false) => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    applyPendingSamples();
    const targets = targetsRef.current;
    const hasTargets = targets.elementIds.size > 0 || targets.strokeIds.size > 0;
    if (!cancelled && hasTargets) {
      pushHistory();
      setStrokes((current) => current.filter((stroke) => !targets.strokeIds.has(stroke.id)));
      setElements((current) => current.filter((element) => !targets.elementIds.has(element.id)));
    }
    reset();
  }, [applyPendingSamples, pushHistory, reset, setElements, setStrokes]);

  useEffect(() => reset, [reset]);

  return { begin, finish, preview, update };
}

function createMutableTargets(): MutableEraserTargets {
  return { elementIds: new Set(), strokeIds: new Set() };
}

function createMutableCandidates(): MutableEraserCandidates {
  return { elements: [], strokes: [] };
}
