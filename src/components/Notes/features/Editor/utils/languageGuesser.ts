/**
 * Language detection for code blocks
 * Zero dependencies, regex-based detection for 100+ languages
 * Optimized for performance with long code samples
 * 
 * This file now uses a modular architecture where each language
 * has its own detector file for better maintainability.
 * 
 * See ./languageDetection/ for individual language detectors.
 */

// Re-export from the modular system
export { guessLanguage } from './languageDetection/index';
export type { DetectionContext } from './languageDetection/types';
