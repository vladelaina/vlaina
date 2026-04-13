import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedPythonCases } from './languageDetectionHandcraftedPython.fixtures';

defineHandcraftedLanguageSuite({
  language: 'python',
  cases: handcraftedPythonCases,
});
