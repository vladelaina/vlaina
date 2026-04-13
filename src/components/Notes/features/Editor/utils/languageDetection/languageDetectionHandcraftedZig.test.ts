import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedZigCases } from './languageDetectionHandcraftedZig.fixtures';

defineHandcraftedLanguageSuite({
  language: 'zig',
  cases: handcraftedZigCases,
});
