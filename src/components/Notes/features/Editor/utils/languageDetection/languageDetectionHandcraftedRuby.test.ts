import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedRubyCases } from './languageDetectionHandcraftedRuby.fixtures';

defineHandcraftedLanguageSuite({
  language: 'ruby',
  cases: handcraftedRubyCases.slice(0, 100),
});
