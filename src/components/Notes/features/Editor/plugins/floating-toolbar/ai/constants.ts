export const TRANSLATE_TO_ENGLISH_PROMPT = 'Translate to English';

export const AI_QUICK_ACTIONS = [
  {
    label: 'Translate to English',
    id: 'translate-english',
    prompt: TRANSLATE_TO_ENGLISH_PROMPT,
    submit: true,
  },
] as const;

export const AI_REVIEW_TRANSLATE_COMMANDS = [
  {
    id: 'translate-en',
    label: '英语',
    instruction: 'Translate the selected text to English.',
  },
  {
    id: 'translate-ko',
    label: '韩语',
    instruction: 'Translate the selected text to Korean.',
  },
  {
    id: 'translate-zh-hans',
    label: '中文 (简体)',
    instruction: 'Translate the selected text to Simplified Chinese.',
  },
  {
    id: 'translate-zh-hant',
    label: '中文 (繁体)',
    instruction: 'Translate the selected text to Traditional Chinese.',
  },
  {
    id: 'translate-ja',
    label: '日语',
    instruction: 'Translate the selected text to Japanese.',
  },
  {
    id: 'translate-es',
    label: '西班牙语',
    instruction: 'Translate the selected text to Spanish.',
  },
  {
    id: 'translate-ru',
    label: '俄语',
    instruction: 'Translate the selected text to Russian.',
  },
  {
    id: 'translate-fr',
    label: '法语',
    instruction: 'Translate the selected text to French.',
  },
  {
    id: 'translate-pt',
    label: '葡萄牙语',
    instruction: 'Translate the selected text to Portuguese.',
  },
  {
    id: 'translate-de',
    label: '德语',
    instruction: 'Translate the selected text to German.',
  },
  {
    id: 'translate-it',
    label: '意大利语',
    instruction: 'Translate the selected text to Italian.',
  },
  {
    id: 'translate-nl',
    label: '荷兰语',
    instruction: 'Translate the selected text to Dutch.',
  },
  {
    id: 'translate-id',
    label: '印度尼西亚语',
    instruction: 'Translate the selected text to Indonesian.',
  },
  {
    id: 'translate-fil',
    label: '菲律宾语',
    instruction: 'Translate the selected text to Filipino.',
  },
  {
    id: 'translate-vi',
    label: '越南语',
    instruction: 'Translate the selected text to Vietnamese.',
  },
  {
    id: 'translate-ar',
    label: '阿拉伯语',
    instruction: 'Translate the selected text to Arabic.',
  },
] as const;

export const AI_REVIEW_ACTION_COMMANDS = [
  {
    id: 'polish',
    label: '润色',
    instruction: 'Polish the selected text while preserving its meaning.',
  },
  {
    id: 'fix-grammar',
    label: '修复语法',
    instruction: 'Fix grammar and awkward phrasing in the selected text.',
  },
  {
    id: 'shorten',
    label: '缩短',
    instruction: 'Make the selected text shorter while preserving its meaning.',
  },
  {
    id: 'lengthen',
    label: '扩写',
    instruction: 'Expand the selected text with a bit more detail while preserving its meaning.',
  },
  {
    id: 'format',
    label: '排版',
    instruction:
      'Reformat the selected text to improve structure, spacing, punctuation, and markdown readability without changing its meaning.',
  },
  {
    id: 'extract',
    label: '提炼',
    instruction:
      'Condense the selected text into its key points while preserving the most important information.',
  },
] as const;

export const AI_REVIEW_COMMANDS = [
  ...AI_REVIEW_TRANSLATE_COMMANDS,
  ...AI_REVIEW_ACTION_COMMANDS,
] as const;

export const AI_REVIEW_TONE_COMMANDS = [
  {
    id: 'tone-professional',
    label: '专业',
    instruction: 'Rewrite the selected text in a professional tone.',
  },
  {
    id: 'tone-casual',
    label: '随意',
    instruction: 'Rewrite the selected text in a casual tone.',
  },
  {
    id: 'tone-clear',
    label: '简单明了',
    instruction: 'Rewrite the selected text in a simple and straightforward tone.',
  },
  {
    id: 'tone-confident',
    label: '自信',
    instruction: 'Rewrite the selected text in a confident tone.',
  },
  {
    id: 'tone-friendly',
    label: '友好',
    instruction: 'Rewrite the selected text in a friendly tone.',
  },
] as const;
