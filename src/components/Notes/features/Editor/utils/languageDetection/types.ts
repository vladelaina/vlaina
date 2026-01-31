export interface DetectionContext {
  code: string;
  sample: string;
  lines: string[];
  firstLine: string;
  first20Lines: string;
  first100Lines: string;
  
  hasCurlyBraces: boolean;
  hasArrow: boolean;
  hasDoubleColon: boolean;
  hasImport: boolean;
  hasFunction: boolean;
  hasConst: boolean;
  hasLet: boolean;
  hasClass: boolean;
  hasSemicolon: boolean;
}

export type LanguageDetector = (ctx: DetectionContext) => string | null;

export interface DetectorConfig {
  name: string;
  priority: number;
  detector: LanguageDetector;
}
