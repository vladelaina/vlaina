import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedJavaScriptCases } from './languageDetectionHandcraftedJavaScript.fixtures';

defineHandcraftedLanguageSuite({
  language: 'javascript',
  cases: handcraftedJavaScriptCases,
});
