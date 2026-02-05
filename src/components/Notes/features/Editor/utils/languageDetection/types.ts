export interface DetectionContext {
  code: string;
  sample: string;
  firstLine: string;
  first100Lines: string;
  lines: string[];
  hasCurlyBraces: boolean;
  hasSemicolon: boolean;
  hasImport: boolean;
  hasConst: boolean;
  hasLet: boolean;
  hasFunction: boolean;
}

export type LanguageDetector = (ctx: DetectionContext) => string | null;

export interface DetectorConfig {
  name: string;
  priority: number;
  detector: LanguageDetector;
}
