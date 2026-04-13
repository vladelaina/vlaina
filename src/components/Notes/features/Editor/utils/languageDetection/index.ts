import { createContext } from './common.ts';
import { detectorRegistry } from './registry.ts';

export function guessLanguage(code: string): string | null {
  if (!code || !code.trim()) {
    return null;
  }

  const context = createContext(code);

  for (const { detector } of detectorRegistry) {
    const result = detector(context);
    if (result) {
      return result;
    }
  }

  return null;
}

export { createContext } from './common';
export type { DetectionContext, LanguageDetector } from './types';
