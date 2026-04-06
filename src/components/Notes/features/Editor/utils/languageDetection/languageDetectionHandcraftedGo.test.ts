import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedGoCases } from './languageDetectionHandcraftedGo.fixtures';

defineHandcraftedLanguageSuite({
  language: 'go',
  cases: handcraftedGoCases,
});
