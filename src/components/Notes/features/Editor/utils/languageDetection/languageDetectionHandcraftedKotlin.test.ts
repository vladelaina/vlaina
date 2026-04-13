import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedKotlinCases } from './languageDetectionHandcraftedKotlin.fixtures';

defineHandcraftedLanguageSuite({
  language: 'kotlin',
  label: 'kotlin',
  cases: handcraftedKotlinCases,
});
