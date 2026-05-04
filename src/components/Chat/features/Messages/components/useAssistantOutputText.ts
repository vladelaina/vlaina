import { useEffect, useMemo, useRef, useState } from 'react';

const ACTIVE_INPUT_WINDOW_MS = 220;
const DEFAULT_CHARS_PER_SECOND = 38;
const FLUSH_CHARS_PER_SECOND = 120;
const LARGE_APPEND_CHARS = 120;
const MAX_ACTIVE_CHARS_PER_SECOND = 132;
const MAX_CHARS_PER_SECOND = 72;
const MAX_FLUSH_CHARS_PER_SECOND = 280;
const MIN_CHARS_PER_SECOND = 18;
const SETTLE_AFTER_MS = 360;
const SETTLE_DRAIN_MIN_MS = 180;
const SETTLE_DRAIN_MAX_MS = 520;
const TARGET_LAG_MS = 120;
const SPEED_SMOOTHING = 0.2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function takeTextPrefix(text: string, count: number): string {
  return Array.from(text).slice(0, count).join('');
}

function textLength(text: string): number {
  return Array.from(text).length;
}

export function useAssistantOutputText(targetText: string, enabled: boolean, resetKey: string): string {
  const [visibleText, setVisibleText] = useState(targetText);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastInputTimeRef = useRef(0);
  const previousTargetRef = useRef(targetText);
  const targetTextRef = useRef(targetText);
  const previousResetKeyRef = useRef(resetKey);
  const targetLengthRef = useRef(textLength(targetText));
  const visibleLengthRef = useRef(targetLengthRef.current);
  const averageSpeedRef = useRef(DEFAULT_CHARS_PER_SECOND);
  const averageChunkSizeRef = useRef(1);
  const averageArrivalSpeedRef = useRef(DEFAULT_CHARS_PER_SECOND);
  const lastInputLengthRef = useRef(targetLengthRef.current);
  const revealRemainderRef = useRef(0);
  const visibleLength = useMemo(() => textLength(visibleText), [visibleText]);

  const stopAnimation = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    lastFrameTimeRef.current = null;
  };

  const syncVisibleText = (nextText: string) => {
    stopAnimation();
    previousTargetRef.current = nextText;
    targetTextRef.current = nextText;
    targetLengthRef.current = textLength(nextText);
    visibleLengthRef.current = targetLengthRef.current;
    averageSpeedRef.current = DEFAULT_CHARS_PER_SECOND;
    averageChunkSizeRef.current = 1;
    averageArrivalSpeedRef.current = DEFAULT_CHARS_PER_SECOND;
    lastInputLengthRef.current = targetLengthRef.current;
    revealRemainderRef.current = 0;
    setVisibleText(nextText);
  };

  useEffect(() => {
    if (previousResetKeyRef.current !== resetKey) {
      previousResetKeyRef.current = resetKey;
      syncVisibleText(targetText);
    }
  }, [resetKey, targetText]);

  useEffect(() => {
    if (!enabled) {
      syncVisibleText(targetText);
      return;
    }

    const previousTarget = previousTargetRef.current;
    if (!targetText.startsWith(previousTarget)) {
      syncVisibleText(targetText);
      return;
    }

    if (targetText === previousTarget) {
      return;
    }

    const appendedLength = textLength(targetText.slice(previousTarget.length));
    if (appendedLength > LARGE_APPEND_CHARS) {
      syncVisibleText(targetText);
      return;
    }

    const currentTime = performance.now();
    const nextTargetLength = textLength(targetText);
    const inputDeltaMs = Math.max(1, currentTime - lastInputTimeRef.current);
    const deltaLength = nextTargetLength - lastInputLengthRef.current;
    const instantSpeed = deltaLength * 1000 / inputDeltaMs;
    const chunkSmoothing = 0.35;
    averageChunkSizeRef.current = averageChunkSizeRef.current * (1 - chunkSmoothing) + appendedLength * chunkSmoothing;
    averageArrivalSpeedRef.current = averageArrivalSpeedRef.current * (1 - chunkSmoothing)
      + clamp(instantSpeed, MIN_CHARS_PER_SECOND, MAX_FLUSH_CHARS_PER_SECOND * 2) * chunkSmoothing;
    averageSpeedRef.current = averageSpeedRef.current * (1 - SPEED_SMOOTHING)
      + clamp(instantSpeed, MIN_CHARS_PER_SECOND, MAX_ACTIVE_CHARS_PER_SECOND) * SPEED_SMOOTHING;
    previousTargetRef.current = targetText;
    targetTextRef.current = targetText;
    targetLengthRef.current = nextTargetLength;
    lastInputTimeRef.current = currentTime;
    lastInputLengthRef.current = nextTargetLength;

    if (animationFrameRef.current === null) {
      const tick = (frameTime: number) => {
        if (lastFrameTimeRef.current === null) {
          lastFrameTimeRef.current = frameTime;
          animationFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        const deltaSeconds = Math.max(0.001, Math.min((frameTime - lastFrameTimeRef.current) / 1000, 0.05));
        lastFrameTimeRef.current = frameTime;

        const targetLength = targetLengthRef.current;
        const currentLength = visibleLengthRef.current;
        const backlog = targetLength - currentLength;
        if (backlog <= 0) {
          stopAnimation();
          return;
        }

        const idleMs = performance.now() - lastInputTimeRef.current;
        const inputActive = idleMs <= ACTIVE_INPUT_WINDOW_MS;
        const settling = !inputActive && idleMs >= SETTLE_AFTER_MS;
        const baseSpeed = clamp(averageSpeedRef.current, MIN_CHARS_PER_SECOND, MAX_CHARS_PER_SECOND);
        const baseLag = Math.max(1, Math.round(baseSpeed * TARGET_LAG_MS / 1000));
        const lagCeiling = Math.max(baseLag + 2, baseLag * 3);
        const targetLag = inputActive
          ? Math.round(clamp(baseLag + averageChunkSizeRef.current * 0.35, baseLag, lagCeiling))
          : 0;
        const desiredLength = Math.max(0, targetLength - targetLag);
        if (inputActive && currentLength >= desiredLength) {
          animationFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        let speed = FLUSH_CHARS_PER_SECOND;
        if (inputActive) {
          const backlogPressure = targetLag > 0 ? backlog / targetLag : 1;
          const chunkPressure = targetLag > 0 ? averageChunkSizeRef.current / targetLag : 1;
          const arrivalPressure = averageArrivalSpeedRef.current / Math.max(baseSpeed, 1);
          const pressure = clamp(backlogPressure * 0.6 + chunkPressure * 0.25 + arrivalPressure * 0.15, 1, 4.5);
          const activeCap = clamp(
            MAX_ACTIVE_CHARS_PER_SECOND + averageChunkSizeRef.current * 6,
            MAX_ACTIVE_CHARS_PER_SECOND,
            MAX_FLUSH_CHARS_PER_SECOND,
          );
          speed = clamp(baseSpeed * pressure, MIN_CHARS_PER_SECOND, activeCap);
        } else if (settling) {
          const drainTargetMs = clamp(backlog * 8, SETTLE_DRAIN_MIN_MS, SETTLE_DRAIN_MAX_MS);
          speed = clamp(backlog * 1000 / drainTargetMs, FLUSH_CHARS_PER_SECOND, MAX_FLUSH_CHARS_PER_SECOND);
        } else {
          speed = clamp(
            Math.max(FLUSH_CHARS_PER_SECOND, baseSpeed * 1.8, averageArrivalSpeedRef.current * 0.8),
            FLUSH_CHARS_PER_SECOND,
            MAX_FLUSH_CHARS_PER_SECOND,
          );
        }

        const revealBudget = revealRemainderRef.current + speed * deltaSeconds;
        const revealCount = Math.floor(revealBudget);
        revealRemainderRef.current = revealBudget - revealCount;
        if (revealCount <= 0) {
          animationFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        const nextLength = Math.min(targetLength, inputActive ? Math.min(desiredLength, currentLength + revealCount) : currentLength + revealCount);
        visibleLengthRef.current = nextLength;
        setVisibleText(takeTextPrefix(targetTextRef.current, nextLength));
        animationFrameRef.current = window.requestAnimationFrame(tick);
      };

      animationFrameRef.current = window.requestAnimationFrame(tick);
    }
  }, [enabled, targetText]);

  useEffect(() => {
    visibleLengthRef.current = visibleLength;
  }, [visibleLength]);

  useEffect(() => () => stopAnimation(), []);

  return visibleText;
}
