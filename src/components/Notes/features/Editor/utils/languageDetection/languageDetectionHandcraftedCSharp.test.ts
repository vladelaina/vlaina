import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedCSharpCases } from './languageDetectionHandcraftedCSharp.fixtures';

defineHandcraftedLanguageSuite({
  language: 'csharp',
  label: 'csharp',
  cases: handcraftedCSharpCases,
});
