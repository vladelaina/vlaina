export type AiReviewVariantShell =
  | 'hairline'
  | 'soft'
  | 'floating'
  | 'inset'
  | 'contrast';

export type AiReviewVariantHeader =
  | 'tight'
  | 'balanced'
  | 'split'
  | 'centered'
  | 'utility'
  | 'minimal';

export type AiReviewVariantControl =
  | 'cluster'
  | 'segmented'
  | 'stacked'
  | 'rail'
  | 'compact'
  | 'inline';

export type AiReviewVariantBody =
  | 'stacked'
  | 'split'
  | 'focus'
  | 'editorial'
  | 'thread'
  | 'merge';

export type AiReviewVariantFooter =
  | 'spread'
  | 'right'
  | 'centered'
  | 'quiet'
  | 'sticky';

export type AiReviewVariantDensity =
  | 'airy'
  | 'balanced'
  | 'compact'
  | 'dense'
  | 'poster'
  | 'calm';

export type AiReviewVariant = {
  id: string;
  name: string;
  description: string;
  shell: AiReviewVariantShell;
  header: AiReviewVariantHeader;
  control: AiReviewVariantControl;
  body: AiReviewVariantBody;
  footer: AiReviewVariantFooter;
  density: AiReviewVariantDensity;
};

type VariantGroup = {
  key: string;
  label: string;
  note: string;
  shell: AiReviewVariantShell;
  header: AiReviewVariantHeader;
  control: AiReviewVariantControl;
  footer: AiReviewVariantFooter;
};

type VariantRecipe = {
  key: string;
  label: string;
  note: string;
  body: AiReviewVariantBody;
  density: AiReviewVariantDensity;
};

const GROUPS: VariantGroup[] = [
  {
    key: 'gallery',
    label: 'Gallery',
    note: '像一张被轻轻托起的白色卡片，重点在留白和秩序。',
    shell: 'floating',
    header: 'balanced',
    control: 'cluster',
    footer: 'spread',
  },
  {
    key: 'desk',
    label: 'Desk',
    note: '更接近桌面工具窗口，边界清晰，但仍然克制。',
    shell: 'hairline',
    header: 'split',
    control: 'segmented',
    footer: 'right',
  },
  {
    key: 'sheet',
    label: 'Sheet',
    note: '像系统面板一样安静，强调内容连续性而不是控件存在感。',
    shell: 'soft',
    header: 'minimal',
    control: 'inline',
    footer: 'quiet',
  },
  {
    key: 'editorial',
    label: 'Editorial',
    note: '更偏文本审阅，控件后退，文字成为第一视觉。',
    shell: 'inset',
    header: 'centered',
    control: 'stacked',
    footer: 'centered',
  },
  {
    key: 'mono',
    label: 'Mono',
    note: '更利落、更硬朗，适合强调 AI 修改是一种精确操作。',
    shell: 'contrast',
    header: 'utility',
    control: 'rail',
    footer: 'sticky',
  },
];

const RECIPES: VariantRecipe[] = [
  {
    key: '01',
    label: 'Quiet Compare',
    note: '上下对照，节奏最稳，适合作为默认基线。',
    body: 'stacked',
    density: 'calm',
  },
  {
    key: '02',
    label: 'Split Review',
    note: '左右分栏，便于直接扫描原文和结果。',
    body: 'split',
    density: 'balanced',
  },
  {
    key: '03',
    label: 'Result Focus',
    note: '结果优先，原文退成辅助上下文。',
    body: 'focus',
    density: 'airy',
  },
  {
    key: '04',
    label: 'Editorial Stack',
    note: '更像审稿界面，标题和 diff 的层级更强。',
    body: 'editorial',
    density: 'poster',
  },
  {
    key: '05',
    label: 'Threaded Review',
    note: '把选中文本和 AI 结果组织成一条连续线程。',
    body: 'thread',
    density: 'compact',
  },
  {
    key: '06',
    label: 'Inline Merge',
    note: '重点放在合并后的结果区，适合减少视觉块数。',
    body: 'merge',
    density: 'dense',
  },
];

export const AI_REVIEW_SELECTED_TEXT =
  'The release notes still feel uneven, and the key changes are easy to miss on a fast read.';

export const AI_REVIEW_RESULT_TEXT =
  'The release notes still feel uneven, and the key updates are easy to miss when someone scans quickly.';

export const AI_REVIEW_DIFF_TEXT = {
  beforeStart: 'The release notes still feel uneven, and the key ',
  removedOne: 'changes',
  addedOne: 'updates',
  middle: ' are easy to miss ',
  removedTwo: 'on a fast read',
  addedTwo: 'when someone scans quickly',
  end: '.',
};

export const AI_REVIEW_ACTIONS = [
  'Translate',
  'Polish',
  'Fix grammar',
  'Shorten',
  'Professional',
] as const;

export const AI_REVIEW_MODELS = ['GPT-5.3', 'Claude 3.7', 'Gemini 2.5'] as const;

export const AI_REVIEW_VARIANTS: AiReviewVariant[] = GROUPS.flatMap((group) =>
  RECIPES.map((recipe) => ({
    id: `${group.key}-${recipe.key}`,
    name: `${group.label} ${recipe.label}`,
    description: `${group.note}${recipe.note}`,
    shell: group.shell,
    header: group.header,
    control: group.control,
    body: recipe.body,
    footer: group.footer,
    density: recipe.density,
  }))
).filter((variant) => new Set(['desk-06', 'sheet-06', 'mono-06']).has(variant.id));
