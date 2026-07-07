import { walkPreparedLinesRaw } from './lineBreakRawWalk'
import type { PreparedLineBreakData } from './lineBreakTypes'

export {
  normalizeLineStart,
} from './lineBreakHelpers'
export {
  layoutNextLineRange,
  measurePreparedLineGeometry,
  stepPreparedLineGeometry,
  walkPreparedLines,
} from './lineBreakGeometry'
export {
  walkPreparedLinesRaw,
} from './lineBreakRawWalk'
export type {
  InternalLayoutLine,
  LineBreakCursor,
  PreparedLineBreakData,
} from './lineBreakTypes'

export function countPreparedLines(prepared: PreparedLineBreakData, maxWidth: number): number {
  return walkPreparedLinesRaw(prepared, maxWidth)
}
