declare namespace Intl {
  interface SegmenterOptions {
    granularity?: 'grapheme' | 'word' | 'sentence';
    localeMatcher?: 'best fit' | 'lookup';
  }

  interface ResolvedSegmenterOptions {
    granularity: 'grapheme' | 'word' | 'sentence';
    locale: string;
  }

  interface SegmentData {
    index: number;
    input: string;
    isWordLike?: boolean;
    segment: string;
  }

  interface Segments {
    [Symbol.iterator](): IterableIterator<SegmentData>;
    containing(index?: number): SegmentData | undefined;
  }

  class Segmenter {
    constructor(locales?: string | string[], options?: SegmenterOptions);
    resolvedOptions(): ResolvedSegmenterOptions;
    segment(input: string): Segments;
  }
}
