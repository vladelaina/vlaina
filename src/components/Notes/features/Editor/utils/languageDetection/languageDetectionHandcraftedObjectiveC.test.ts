import { defineHandcraftedLanguageSuite } from './languageDetectionHandcrafted';
import { handcraftedObjectiveCCases } from './languageDetectionHandcraftedObjectiveC.fixtures';

defineHandcraftedLanguageSuite({
  language: 'objectivec',
  label: 'objective-c',
  cases: handcraftedObjectiveCCases,
});
