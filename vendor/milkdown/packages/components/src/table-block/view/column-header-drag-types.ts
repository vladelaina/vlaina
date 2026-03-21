export interface PressSession {
  pointerId: number
  index: number
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export interface DragSession {
  pointerId: number
  from: number
  to: number
  lastNonOriginTo: number | null
  currentX: number
  currentY: number
}

export interface HoverSession {
  index: number
  localY: number
}

export interface PointerPosition {
  clientX: number
  clientY: number
}
