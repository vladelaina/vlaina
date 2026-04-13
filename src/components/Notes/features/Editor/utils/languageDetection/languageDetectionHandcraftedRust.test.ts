import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedRustCases } from './languageDetectionHandcraftedRust.fixtures';

defineHandcraftedLanguageSuite({
  language: 'rust',
  cases: handcraftedRustCases,
});
