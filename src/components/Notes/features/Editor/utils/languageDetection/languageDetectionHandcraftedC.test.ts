import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedCCases } from './languageDetectionHandcraftedC.fixtures';

defineHandcraftedLanguageSuite({
  language: 'c',
  cases: handcraftedCCases,
});
