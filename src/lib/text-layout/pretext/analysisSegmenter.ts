let sharedWordSegmenter: Intl.Segmenter | null = null
let segmenterLocale: string | undefined

export function getSharedWordSegmenter(): Intl.Segmenter {
  if (sharedWordSegmenter === null) {
    sharedWordSegmenter = new Intl.Segmenter(segmenterLocale, { granularity: 'word' })
  }
  return sharedWordSegmenter
}

export function clearAnalysisCaches(): void {
  sharedWordSegmenter = null
}

export function setAnalysisLocale(locale?: string): void {
  const nextLocale = locale && locale.length > 0 ? locale : undefined
  if (segmenterLocale === nextLocale) return
  segmenterLocale = nextLocale
  sharedWordSegmenter = null
}
