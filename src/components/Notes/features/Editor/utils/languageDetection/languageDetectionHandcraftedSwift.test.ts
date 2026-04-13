import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedSwiftCases } from './languageDetectionHandcraftedSwift.fixtures';

defineHandcraftedLanguageSuite({
  language: 'swift',
  cases: handcraftedSwiftCases,
});
