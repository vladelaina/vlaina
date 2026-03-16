export type EdgeCreateAxis = 'row' | 'col'
export type EdgeCreateAction = 'expand' | 'shrink'

export interface EdgeCreateAnchors {
  expandTriggerCoord: number
  shrinkTriggerCoord: number
}

export function createEdgeCreateAnchors(
  cursorCoord: number,
  edgeCoord: number,
  threshold: number
): EdgeCreateAnchors {
  return {
    expandTriggerCoord: Math.max(cursorCoord, edgeCoord) + threshold,
    shrinkTriggerCoord: Math.min(cursorCoord, edgeCoord) - threshold,
  }
}

export function resolveEdgeCreateAction(args: {
  currentCoord: number
  previousCoord: number
  anchors: EdgeCreateAnchors
}): EdgeCreateAction | null {
  const { currentCoord, previousCoord, anchors } = args

  if (currentCoord > previousCoord) {
    return currentCoord >= anchors.expandTriggerCoord ? 'expand' : null
  }

  if (currentCoord < previousCoord) {
    return currentCoord <= anchors.shrinkTriggerCoord ? 'shrink' : null
  }

  return null
}
