import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedCppCases } from './languageDetectionHandcraftedCpp.fixtures';

defineHandcraftedLanguageSuite({
  language: 'cpp',
  cases: handcraftedCppCases,
});
