import { assertEnglishPromptText } from './promptValidation';

export interface AiPromptCommand {
  id: string;
  label: string;
  instruction: string;
}

export interface AiPromptGroup {
  id: string;
  label: string;
  tone: boolean;
  items: readonly AiPromptCommand[];
}

export const EDITOR_AI_SYSTEM_PROMPT = [
  'You are editing text selected inside a markdown note editor.',
  'Return only the edited selection.',
  'Do not add explanations, introductions, quotation marks, or code fences.',
  'Preserve line breaks, links, inline code, list markers, and markdown structure whenever possible.',
].join(' ');

export const TRANSLATE_TO_ENGLISH_PROMPT = 'Translate to English';

export const AI_REVIEW_TRANSLATE_COMMANDS: readonly AiPromptCommand[] = [
  { id: 'translate-en', label: '英语', instruction: 'Translate the selected text to English.' },
  { id: 'translate-ko', label: '韩语', instruction: 'Translate the selected text to Korean.' },
  { id: 'translate-zh-hans', label: '中文 (简体)', instruction: 'Translate the selected text to Simplified Chinese.' },
  { id: 'translate-zh-hant', label: '中文 (繁体)', instruction: 'Translate the selected text to Traditional Chinese.' },
  { id: 'translate-ja', label: '日语', instruction: 'Translate the selected text to Japanese.' },
  { id: 'translate-es', label: '西班牙语', instruction: 'Translate the selected text to Spanish.' },
  { id: 'translate-ru', label: '俄语', instruction: 'Translate the selected text to Russian.' },
  { id: 'translate-fr', label: '法语', instruction: 'Translate the selected text to French.' },
  { id: 'translate-pt', label: '葡萄牙语', instruction: 'Translate the selected text to Portuguese.' },
  { id: 'translate-de', label: '德语', instruction: 'Translate the selected text to German.' },
  { id: 'translate-it', label: '意大利语', instruction: 'Translate the selected text to Italian.' },
  { id: 'translate-nl', label: '荷兰语', instruction: 'Translate the selected text to Dutch.' },
  { id: 'translate-id', label: '印度尼西亚语', instruction: 'Translate the selected text to Indonesian.' },
  { id: 'translate-fil', label: '菲律宾语', instruction: 'Translate the selected text to Filipino.' },
  { id: 'translate-vi', label: '越南语', instruction: 'Translate the selected text to Vietnamese.' },
  { id: 'translate-ar', label: '阿拉伯语', instruction: 'Translate the selected text to Arabic.' },
];

export const AI_REVIEW_ACTION_COMMANDS: readonly AiPromptCommand[] = [
  { id: 'polish', label: '润色', instruction: 'Polish the selected text while preserving its meaning.' },
  { id: 'fix-grammar', label: '修复语法', instruction: 'Fix grammar and awkward phrasing in the selected text.' },
  { id: 'shorten', label: '缩短', instruction: 'Make the selected text shorter while preserving its meaning.' },
  { id: 'lengthen', label: '扩写', instruction: 'Expand the selected text with a bit more detail while preserving its meaning.' },
  {
    id: 'format',
    label: '排版',
    instruction: 'Reformat the selected text to improve structure, spacing, punctuation, and markdown readability without changing its meaning.',
  },
  {
    id: 'extract',
    label: '提炼',
    instruction: 'Condense the selected text into its key points while preserving the most important information.',
  },
];

export const AI_REVIEW_TONE_COMMANDS: readonly AiPromptCommand[] = [
  { id: 'tone-professional', label: '专业', instruction: 'Rewrite the selected text in a professional tone.' },
  { id: 'tone-casual', label: '随意', instruction: 'Rewrite the selected text in a casual tone.' },
  { id: 'tone-clear', label: '简单明了', instruction: 'Rewrite the selected text in a simple and straightforward tone.' },
  { id: 'tone-confident', label: '自信', instruction: 'Rewrite the selected text in a confident tone.' },
  { id: 'tone-friendly', label: '友好', instruction: 'Rewrite the selected text in a friendly tone.' },
];

export const AI_REVIEW_COMMANDS: readonly AiPromptCommand[] = [
  ...AI_REVIEW_TRANSLATE_COMMANDS,
  ...AI_REVIEW_ACTION_COMMANDS,
];

export const AI_PROMPT_GROUPS: readonly AiPromptGroup[] = [
  {
    id: 'translate',
    label: '翻译',
    items: AI_REVIEW_TRANSLATE_COMMANDS,
    tone: false,
  },
  {
    id: 'actions',
    label: '编辑',
    items: AI_REVIEW_ACTION_COMMANDS,
    tone: false,
  },
  {
    id: 'tone',
    label: '语气',
    items: AI_REVIEW_TONE_COMMANDS,
    tone: true,
  },
];

export const AI_QUICK_ACTIONS = [
  {
    label: 'Translate to English',
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
}

validatePromptCatalog();
