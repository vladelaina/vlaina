import { useEffect } from 'react';
import type { WhiteboardConnector, WhiteboardElement, WhiteboardStroke, WhiteboardViewport } from '../model/whiteboardModel';
import type { WhiteboardRulerState } from './useWhiteboardRuler';

const WHITEBOARD_STORAGE_KEY = 'vlaina:whiteboard:v1';
const WHITEBOARD_PERSISTENCE_DELAY_MS = 250;

type IdleWindow = Window & {
  cancelIdleCallback?: (id: number) => void;
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

interface WhiteboardSnapshot {
  connectors: WhiteboardConnector[];
  elements: WhiteboardElement[];
  strokes: WhiteboardStroke[];
  viewport: WhiteboardViewport;
  ruler?: WhiteboardRulerState;
}

export function loadWhiteboardSnapshot(): Partial<WhiteboardSnapshot> {
  try {
    const rawSnapshot = window.localStorage.getItem(WHITEBOARD_STORAGE_KEY);
    return rawSnapshot ? JSON.parse(rawSnapshot) as Partial<WhiteboardSnapshot> : {};
  } catch {
    return {};
  }
}

export function useWhiteboardPersistence(snapshot: WhiteboardSnapshot) {
  useEffect(() => {
    let idleId: number | null = null;
    const persist = () => {
      try {
        window.localStorage.setItem(WHITEBOARD_STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // A full localStorage should not interrupt drawing.
      }
    };
    const timeoutId = window.setTimeout(() => {
      const idleWindow = window as IdleWindow;
      if (!idleWindow.requestIdleCallback) {
        persist();
        return;
      }
      idleId = idleWindow.requestIdleCallback(persist, { timeout: WHITEBOARD_PERSISTENCE_DELAY_MS });
    }, WHITEBOARD_PERSISTENCE_DELAY_MS);
    return () => {
      window.clearTimeout(timeoutId);
      if (idleId !== null) (window as IdleWindow).cancelIdleCallback?.(idleId);
    };
  }, [snapshot.connectors, snapshot.elements, snapshot.ruler, snapshot.strokes, snapshot.viewport]);
}
