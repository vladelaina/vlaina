import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedPHPCases } from './languageDetectionHandcraftedPHP.fixtures';

defineHandcraftedLanguageSuite({
  language: 'php',
  cases: handcraftedPHPCases,
});
