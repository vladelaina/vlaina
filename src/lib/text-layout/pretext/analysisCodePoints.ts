const arabicScriptRe = /\p{Script=Arabic}/u
export const combiningMarkRe = /\p{M}/u
export const decimalDigitRe = /\p{Nd}/u

export function containsArabicScript(text: string): boolean {
  return arabicScriptRe.test(text)
}

function isCJKCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x4E00 && codePoint <= 0x9FFF) ||
    (codePoint >= 0x3400 && codePoint <= 0x4DBF) ||
    (codePoint >= 0x20000 && codePoint <= 0x2A6DF) ||
    (codePoint >= 0x2A700 && codePoint <= 0x2B73F) ||
    (codePoint >= 0x2B740 && codePoint <= 0x2B81F) ||
    (codePoint >= 0x2B820 && codePoint <= 0x2CEAF) ||
    (codePoint >= 0x2CEB0 && codePoint <= 0x2EBEF) ||
    (codePoint >= 0x2EBF0 && codePoint <= 0x2EE5D) ||
    (codePoint >= 0x2F800 && codePoint <= 0x2FA1F) ||
    (codePoint >= 0x30000 && codePoint <= 0x3134F) ||
    (codePoint >= 0x31350 && codePoint <= 0x323AF) ||
    (codePoint >= 0x323B0 && codePoint <= 0x33479) ||
    (codePoint >= 0xF900 && codePoint <= 0xFAFF) ||
    (codePoint >= 0x3000 && codePoint <= 0x303F) ||
    (codePoint >= 0x3040 && codePoint <= 0x309F) ||
    (codePoint >= 0x30A0 && codePoint <= 0x30FF) ||
    (codePoint >= 0x3130 && codePoint <= 0x318F) ||
    (codePoint >= 0xAC00 && codePoint <= 0xD7AF) ||
    (codePoint >= 0xFF00 && codePoint <= 0xFFEF)
  )
}

export function isCJK(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const first = s.charCodeAt(i)
    if (first < 0x3000) continue

    if (first >= 0xD800 && first <= 0xDBFF && i + 1 < s.length) {
      const second = s.charCodeAt(i + 1)
      if (second >= 0xDC00 && second <= 0xDFFF) {
        const codePoint = ((first - 0xD800) << 10) + (second - 0xDC00) + 0x10000
        if (isCJKCodePoint(codePoint)) return true
        i++
        continue
      }
    }

    if (isCJKCodePoint(first)) return true
  }
  return false
}

export function previousCodePointStart(text: string, end: number): number {
  const last = end - 1
  if (last <= 0) return Math.max(last, 0)

  const lastCodeUnit = text.charCodeAt(last)
  if (lastCodeUnit < 0xDC00 || lastCodeUnit > 0xDFFF) return last

  const maybeHigh = last - 1
  if (maybeHigh < 0) return last

  const highCodeUnit = text.charCodeAt(maybeHigh)
  return highCodeUnit >= 0xD800 && highCodeUnit <= 0xDBFF ? maybeHigh : last
}

export function getLastCodePoint(text: string): string | null {
  if (text.length === 0) return null
  const start = previousCodePointStart(text, text.length)
  return text.slice(start)
}
