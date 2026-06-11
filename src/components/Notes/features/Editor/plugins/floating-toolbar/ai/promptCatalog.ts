import { assertEnglishPromptText } from './promptValidation';
import { translate } from '@/lib/i18n';

export interface AiPromptCommand {
  id: string;
  label: string;
  instruction: string;
  behavior?: 'review' | 'sidebar-chat';
  icon?: 'quote';
  shortcut?: string;
}

export interface AiPromptGroup {
  id: string;
  label: string;
  tone: boolean;
  items: readonly AiPromptCommand[];
  rootAction?: AiPromptCommand;
}

export const EDITOR_AI_SYSTEM_PROMPT = [
  'You are editing text selected inside a markdown note editor.',
  'Return only the edited selection.',
  'Do not add explanations, introductions, quotation marks, or code fences.',
  'Preserve line breaks, links, inline code, list markers, and markdown structure whenever possible.',
].join(' ');

export const TRANSLATE_TO_ENGLISH_PROMPT = 'Translate to English';

export const AI_REVIEW_TRANSLATE_COMMANDS: readonly AiPromptCommand[] = [
  { id: 'translate-en', get label() { return translate('editor.ai.translate.english'); }, instruction: 'Translate the selected text to English.' },
  { id: 'translate-zh-hans', get label() { return translate('editor.ai.translate.chineseSimplified'); }, instruction: 'Translate the selected text to Simplified Chinese.' },
  { id: 'translate-zh-hant', get label() { return translate('editor.ai.translate.chineseTraditional'); }, instruction: 'Translate the selected text to Traditional Chinese.' },
  { id: 'translate-ja', get label() { return translate('editor.ai.translate.japanese'); }, instruction: 'Translate the selected text to Japanese.' },
  { id: 'translate-ko', get label() { return translate('editor.ai.translate.korean'); }, instruction: 'Translate the selected text to Korean.' },
  { id: 'translate-es', get label() { return translate('editor.ai.translate.spanish'); }, instruction: 'Translate the selected text to Spanish.' },
  { id: 'translate-ru', get label() { return translate('editor.ai.translate.russian'); }, instruction: 'Translate the selected text to Russian.' },
  { id: 'translate-fr', get label() { return translate('editor.ai.translate.french'); }, instruction: 'Translate the selected text to French.' },
  { id: 'translate-pt', get label() { return translate('editor.ai.translate.portuguese'); }, instruction: 'Translate the selected text to Portuguese.' },
  { id: 'translate-de', get label() { return translate('editor.ai.translate.german'); }, instruction: 'Translate the selected text to German.' },
  { id: 'translate-it', get label() { return translate('editor.ai.translate.italian'); }, instruction: 'Translate the selected text to Italian.' },
  { id: 'translate-nl', get label() { return translate('editor.ai.translate.dutch'); }, instruction: 'Translate the selected text to Dutch.' },
  { id: 'translate-id', get label() { return translate('editor.ai.translate.indonesian'); }, instruction: 'Translate the selected text to Indonesian.' },
  { id: 'translate-fil', get label() { return translate('editor.ai.translate.filipino'); }, instruction: 'Translate the selected text to Filipino.' },
  { id: 'translate-vi', get label() { return translate('editor.ai.translate.vietnamese'); }, instruction: 'Translate the selected text to Vietnamese.' },
  { id: 'translate-ar', get label() { return translate('editor.ai.translate.arabic'); }, instruction: 'Translate the selected text to Arabic.' },
];

export const AI_REVIEW_ACTION_COMMANDS: readonly AiPromptCommand[] = [
  { id: 'polish', get label() { return translate('editor.ai.action.polish'); }, instruction: 'Polish the selected text while preserving its meaning.' },
  { id: 'rewrite', get label() { return translate('editor.ai.action.rewrite'); }, instruction: 'Rewrite the selected text with different wording while preserving its meaning.' },
  { id: 'fix-grammar', get label() { return translate('editor.ai.action.fixGrammar'); }, instruction: 'Fix grammar and awkward phrasing in the selected text.' },
  { id: 'fix-typos', get label() { return translate('editor.ai.action.fixTypos'); }, instruction: 'Correct typos and spelling mistakes in the selected text while preserving its wording, meaning, tone, and markdown structure. Do not rewrite beyond typo corrections.' },
  { id: 'simplify', get label() { return translate('editor.ai.action.simplify'); }, instruction: 'Simplify the selected text so it is easier to understand while preserving its meaning.' },
  { id: 'clarify', get label() { return translate('editor.ai.action.clarify'); }, instruction: 'Rewrite the selected text to improve clarity and readability without changing its meaning.' },
  { id: 'shorten', get label() { return translate('editor.ai.action.shorten'); }, instruction: 'Make the selected text shorter while preserving its meaning.' },
  { id: 'lengthen', get label() { return translate('editor.ai.action.lengthen'); }, instruction: 'Expand the selected text with a bit more detail while preserving its meaning.' },
  {
    id: 'format',
    get label() { return translate('editor.ai.action.format'); },
    instruction: 'Reformat the selected text to improve structure, spacing, punctuation, and markdown readability without changing its meaning.',
  },
  {
    id: 'extract',
    get label() { return translate('editor.ai.action.extract'); },
    instruction: 'Condense the selected text into its key points while preserving the most important information.',
  },
];

export const AI_SIDEBAR_COMMANDS: readonly AiPromptCommand[] = [
  {
    id: 'discuss-in-sidebar',
    get label() { return translate('editor.ai.action.quoteToChat'); },
    instruction: 'Quote the selected text into the floating AI chat input.',
    behavior: 'sidebar-chat',
    shortcut: 'Ctrl+L',
  },
];

export const AI_REVIEW_TONE_COMMANDS: readonly AiPromptCommand[] = [
  {
    id: 'tone-context-fit',
    get label() { return translate('editor.ai.tone.contextFit'); },
    instruction: 'Rewrite the selected text so its tone fits the surrounding context while preserving its meaning.',
  },
  { id: 'tone-professional', get label() { return translate('editor.ai.tone.professional'); }, instruction: 'Rewrite the selected text in a professional tone.' },
  { id: 'tone-clear', get label() { return translate('editor.ai.tone.clear'); }, instruction: 'Rewrite the selected text in a simple and straightforward tone.' },
  { id: 'tone-friendly', get label() { return translate('editor.ai.tone.friendly'); }, instruction: 'Rewrite the selected text in a friendly tone.' },
  { id: 'tone-casual', get label() { return translate('editor.ai.tone.casual'); }, instruction: 'Rewrite the selected text in a casual tone.' },
  { id: 'tone-direct', get label() { return translate('editor.ai.tone.direct'); }, instruction: 'Rewrite the selected text in a direct tone.' },
  { id: 'tone-confident', get label() { return translate('editor.ai.tone.confident'); }, instruction: 'Rewrite the selected text in a confident tone.' },
  { id: 'tone-persuasive', get label() { return translate('editor.ai.tone.persuasive'); }, instruction: 'Rewrite the selected text in a persuasive tone.' },
  { id: 'tone-empathetic', get label() { return translate('editor.ai.tone.empathetic'); }, instruction: 'Rewrite the selected text in an empathetic tone.' },
];

export const AI_REVIEW_COMMANDS: readonly AiPromptCommand[] = [
  ...AI_REVIEW_TRANSLATE_COMMANDS,
  ...AI_REVIEW_ACTION_COMMANDS,
];

export const AI_PROMPT_GROUPS: readonly AiPromptGroup[] = [
  {
    id: 'translate',
    get label() { return translate('editor.ai.group.translate'); },
    items: AI_REVIEW_TRANSLATE_COMMANDS,
    tone: false,
  },
  {
    id: 'sidebar',
    get label() { return translate('editor.ai.action.quoteToChat'); },
    items: [],
    tone: false,
    rootAction: AI_SIDEBAR_COMMANDS[0],
  },
  {
    id: 'actions',
    get label() { return translate('editor.ai.group.edit'); },
    items: AI_REVIEW_ACTION_COMMANDS,
    tone: false,
  },
  {
    id: 'tone',
    get label() { return translate('editor.ai.group.tone'); },
    items: AI_REVIEW_TONE_COMMANDS,
    tone: true,
  },
];

export const AI_QUICK_ACTIONS = [
  {
    get label() {
      return translate('editor.ai.translateToEnglish');
    },
    id: 'translate-english',
    prompt: TRANSLATE_TO_ENGLISH_PROMPT,
    submit: true,
  },
] as const;

function validatePromptCatalog() {
  assertEnglishPromptText('EDITOR_AI_SYSTEM_PROMPT', EDITOR_AI_SYSTEM_PROMPT);
  assertEnglishPromptText('TRANSLATE_TO_ENGLISH_PROMPT', TRANSLATE_TO_ENGLISH_PROMPT);

  for (const command of AI_REVIEW_COMMANDS) {
    assertEnglishPromptText(`AI_REVIEW_COMMANDS.${command.id}`, command.instruction);
  }

  for (const tone of AI_REVIEW_TONE_COMMANDS) {
    assertEnglishPromptText(`AI_REVIEW_TONE_COMMANDS.${tone.id}`, tone.instruction);
  }

  for (const action of AI_QUICK_ACTIONS) {
    assertEnglishPromptText(`AI_QUICK_ACTIONS.${action.id}`, action.prompt);
  }

  for (const group of AI_PROMPT_GROUPS) {
    if (group.rootAction) {
      assertEnglishPromptText(`AI_PROMPT_GROUPS.${group.id}.rootAction`, group.rootAction.instruction);
    }

    for (const item of group.items) {
      assertEnglishPromptText(`AI_PROMPT_GROUPS.${group.id}.${item.id}`, item.instruction);
    }
  }
}

validatePromptCatalog();
