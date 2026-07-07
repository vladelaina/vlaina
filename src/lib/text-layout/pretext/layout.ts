import { clearAnalysisCaches, setAnalysisLocale } from './analysis.js'
import { clearMeasurementCaches } from './measurement.js'
import { clearLineTextCaches } from './line-text.js'
import { clearSharedGraphemeSegmenter } from './layoutGraphemeUnits.js'

export type {
  LayoutCursor,
  LayoutLine,
  LayoutLineRange,
  LayoutLinesResult,
  LayoutResult,
  LineStats,
  PrepareOptions,
  PreparedText,
  PreparedTextWithSegments,
  WordBreakMode,
} from './layoutTypes.js'
export {
  prepare,
  prepareWithSegments,
} from './layoutPrepare.js'
export {
  layout,
  layoutNextLine,
  layoutNextLineRange,
  layoutWithLines,
  materializeLineRange,
  measureLineStats,
  measureNaturalWidth,
  walkLineRanges,
} from './layoutLines.js'

export function clearCache(): void {
  clearAnalysisCaches()
  clearSharedGraphemeSegmenter()
  clearLineTextCaches()
  clearMeasurementCaches()
}

export function setLocale(locale?: string): void {
  setAnalysisLocale(locale)
  clearCache()
}
