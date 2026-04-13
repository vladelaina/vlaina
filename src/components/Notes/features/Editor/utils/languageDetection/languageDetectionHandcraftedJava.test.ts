import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedJavaCases } from './languageDetectionHandcraftedJava.fixtures';

defineHandcraftedLanguageSuite({
  language: 'java',
  cases: handcraftedJavaCases,
});
