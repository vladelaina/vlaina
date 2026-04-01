import type { Alignment } from '../types';

export const LONG_PRESS_DELAY_MS = 300;

export type DragPhase = 'idle' | 'pressing' | 'dragging';

export interface DragSession {
    phase: DragPhase;
    sourcePos: number | null;
    startX: number;
    startY: number;
    startTime: number;
    initialLeft: number;
    initialTop: number;
    sourceWidth: number;
    sourceHeight: number;
    targetPos: number | null;
    alignment: Alignment;
    longPressTimeoutId?: ReturnType<typeof setTimeout>;
}

interface CreateDragSessionOptions {
    sourcePos: number;
    clientX: number;
    clientY: number;
    initialLeft: number;
    initialTop: number;
    sourceWidth: number;
    sourceHeight: number;
    alignment: Alignment;
}

export function createDragSession(options: CreateDragSessionOptions): DragSession {
    const {
        sourcePos,
        clientX,
        clientY,
        initialLeft,
        initialTop,
        sourceWidth,
        sourceHeight,
        alignment,
    } = options;

    return {
        phase: 'pressing',
        sourcePos,
        startX: clientX,
        startY: clientY,
        startTime: Date.now(),
        initialLeft,
        initialTop,
        sourceWidth,
        sourceHeight,
        targetPos: sourcePos,
        alignment,
    };
}

export function beginDragSession(session: DragSession, currentAlignment: Alignment): boolean {
    if (session.phase !== 'pressing') return false;

    session.phase = 'dragging';
    session.alignment = currentAlignment;
    session.targetPos = session.sourcePos;
    return true;
}

export function getDragDelta(session: DragSession, clientX: number, clientY: number) {
    return {
        deltaX: clientX - session.startX,
        deltaY: clientY - session.startY,
    };
}

export function getDragPosition(session: DragSession, clientX: number, clientY: number) {
    const { deltaX, deltaY } = getDragDelta(session, clientX, clientY);

    return {
        x: session.initialLeft + deltaX,
        y: session.initialTop + deltaY,
    };
}

export function getFinalTargetPos(session: DragSession): number | null {
    if (session.sourcePos === null) return null;
    return session.targetPos ?? session.sourcePos;
}

export function shouldCommitDragSession(session: DragSession): boolean {
    return session.phase === 'dragging' && session.sourcePos !== null;
}
