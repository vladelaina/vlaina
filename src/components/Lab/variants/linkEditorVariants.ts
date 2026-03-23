export type LinkEditorShell =
  | 'line'
  | 'card'
  | 'soft'
  | 'capsule'
  | 'panel';

export type LinkEditorField =
  | 'plain'
  | 'outlined'
  | 'filled'
  | 'underlined'
  | 'capsule'
  | 'split';

export type LinkEditorAction =
  | 'check'
  | 'dual'
  | 'footer'
  | 'inline'
  | 'right';

export type LinkEditorDensity = 'airy' | 'balanced' | 'compact';

export type LinkEditorLayout =
  | 'stacked'
  | 'rail'
  | 'strip'
  | 'ribbon'
  | 'inspector'
  | 'split';

export type LinkEditorVariant = {
  id: string;
  name: string;
  description: string;
  shell: LinkEditorShell;
  field: LinkEditorField;
  action: LinkEditorAction;
  density: LinkEditorDensity;
  layout: LinkEditorLayout;
};

type VariantGroup = {
  key: string;
  label: string;
  note: string;
  shell: LinkEditorShell;
  field: LinkEditorField;
  action: LinkEditorAction;
  density: LinkEditorDensity;
};

type VariantRecipe = {
  key: string;
  label: string;
  note: string;
  layout: LinkEditorLayout;
};

const GROUPS: VariantGroup[] = [
  {
    key: 'bare',
    label: 'Bare',
    note: '尽量少界面，重点只剩文字、输入和值。',
    shell: 'line',
    field: 'plain',
    action: 'check',
    density: 'airy',
  },
  {
    key: 'quiet',
    label: 'Quiet',
    note: '轻边框、轻阴影，默认编辑卡片的最简版本。',
    shell: 'card',
    field: 'outlined',
    action: 'dual',
    density: 'balanced',
  },
  {
    key: 'soft',
    label: 'Soft',
    note: '边界更柔一点，但不增加信息负担。',
    shell: 'soft',
    field: 'filled',
    action: 'footer',
    density: 'balanced',
  },
  {
    key: 'capsule',
    label: 'Capsule',
    note: '偏高频操作，把编辑压得更短更紧。',
    shell: 'capsule',
    field: 'capsule',
    action: 'inline',
    density: 'compact',
  },
  {
    key: 'panel',
    label: 'Panel',
    note: '更像工具面板，但仍然只保留必要结构。',
    shell: 'panel',
    field: 'split',
    action: 'right',
    density: 'compact',
  },
];

const RECIPES: VariantRecipe[] = [
  {
    key: '01',
    label: 'Stacked',
    note: '两行字段上下排，最直接。',
    layout: 'stacked',
  },
  {
    key: '02',
    label: 'Rail',
    note: '固定贴正文列，位置稳定。',
    layout: 'rail',
  },
  {
    key: '03',
    label: 'Strip',
    note: '一条横向编辑条，减少层级。',
    layout: 'strip',
  },
  {
    key: '04',
    label: 'Ribbon',
    note: '像正文下方长出的编辑带。',
    layout: 'ribbon',
  },
  {
    key: '05',
    label: 'Inspector',
    note: '右侧小面板，结构最清楚。',
    layout: 'inspector',
  },
  {
    key: '06',
    label: 'Split',
    note: '左右分仓，把说明和字段拆开。',
    layout: 'split',
  },
];

export const LINK_EDITOR_VARIANTS: LinkEditorVariant[] = GROUPS.flatMap((group) =>
  RECIPES.map((recipe) => ({
    id: `${group.key}-${recipe.key}`,
    name: `${group.label} ${recipe.label}`,
    description: `${group.note}${recipe.note}`,
    shell: group.shell,
    field: group.field,
    action: group.action,
    density: group.density,
    layout: recipe.layout,
  }))
);
