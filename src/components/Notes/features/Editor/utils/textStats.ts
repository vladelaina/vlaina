export interface TextStats {
  lineCount: number;
  wordCount: number;
  characterCount: number;
}

type SegmentLike = {
  isWordLike?: boolean;
};

type SegmenterLike = {
  segment: (input: string) => Iterable<SegmentLike>;
};

type SegmenterCtor = new (
  locales?: string | string[],
  options?: { granularity: 'word' },
) => SegmenterLike;

function countLines(text: string): number {
  if (text.length === 0) return 0;
  return text.split(/\r\n|\r|\n/).length;
}

function countWords(text: string): number {
  const normalized = text.trim();
  if (normalized.length === 0) return 0;

  const segmenterCtor = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  if (segmenterCtor) {
    const segmenter = new segmenterCtor(undefined, { granularity: 'word' });
    let count = 0;
    for (const segment of segmenter.segment(normalized)) {
      if (segment.isWordLike) count += 1;
    }
    return count;
  }

  const latinLikeWords =
    normalized.match(/[A-Za-z0-9\u00C0-\u024F]+(?:['’_-][A-Za-z0-9\u00C0-\u024F]+)*/g) ?? [];
  const cjkChars = normalized.match(/[\u3400-\u9FFF\uF900-\uFAFF]/g) ?? [];
  return latinLikeWords.length + cjkChars.length;
}

function countCharacters(text: string): number {
  return Array.from(text).length;
}

export function calculateTextStats(text: string): TextStats {
  return {
    lineCount: countLines(text),
    wordCount: countWords(text),
    characterCount: countCharacters(text),
  };
}
