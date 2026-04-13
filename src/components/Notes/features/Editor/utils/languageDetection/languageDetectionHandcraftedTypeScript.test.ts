import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedTypeScriptCases } from './languageDetectionHandcraftedTypeScript.fixtures';

defineHandcraftedLanguageSuite({
  language: 'typescript',
  cases: handcraftedTypeScriptCases,
});
