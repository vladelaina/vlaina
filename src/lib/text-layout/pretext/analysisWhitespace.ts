import type { WhiteSpaceMode, WhiteSpaceProfile } from './analysisTypes'

const collapsibleWhitespaceRunRe = /[ \t\n\r\f]+/g
const needsWhitespaceNormalizationRe = /[\t\n\r\f]| {2,}|^ | $/

export function getWhiteSpaceProfile(whiteSpace?: WhiteSpaceMode): WhiteSpaceProfile {
  const mode = whiteSpace ?? 'normal'
  return mode === 'pre-wrap'
    ? { mode, preserveOrdinarySpaces: true, preserveHardBreaks: true }
    : { mode, preserveOrdinarySpaces: false, preserveHardBreaks: false }
}

export function normalizeWhitespaceNormal(text: string): string {
  if (!needsWhitespaceNormalizationRe.test(text)) return text

  let normalized = text.replace(collapsibleWhitespaceRunRe, ' ')
  if (normalized.charCodeAt(0) === 0x20) {
    normalized = normalized.slice(1)
  }
  if (normalized.length > 0 && normalized.charCodeAt(normalized.length - 1) === 0x20) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

export function normalizeWhitespacePreWrap(text: string): string {
  if (!/[\r\f]/.test(text)) return text
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[\r\f]/g, '\n')
}
