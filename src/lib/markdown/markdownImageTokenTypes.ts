export interface ImageToken {
  start: number;
  end: number;
  src: string | null;
  targetStart?: number;
  targetEnd?: number;
}

export interface ImageTokenParseOptions {
  maxTokens?: number;
}
