import type { ColorOption, BlockTypeConfig, BlockType } from './types';

const TOOLBAR_COLOR_HEXES = [
  '#f1fdf3', '#e6f4e7', '#d1e9d3', '#99cda9',
  '#e7f0d3', '#d2ea9c', '#abcb88', '#84b271',
  '#e3fdfc', '#cbf1f4', '#a6e3e8', '#71c9cd',
  '#fff9f9', '#ffdfe0', '#ffc1d0', '#fca9bd',
  '#f8ddfe', '#f2c0ff', '#c09fee', '#866ec6',
] as const;

const TOOLBAR_COLOR_OPTIONS: ColorOption[] = TOOLBAR_COLOR_HEXES.map((color, index) => ({
  id: `custom-${index + 1}`,
  label: `Color ${index + 1}`,
  textColor: color,
  bgColor: color,
}));

export const COLOR_PALETTE: ColorOption[] = [
  { id: 'default', label: 'Default' },
  ...TOOLBAR_COLOR_OPTIONS,
];

export const COLOR_PALETTE_DARK: ColorOption[] = [
  { id: 'default', label: 'Default' },
  ...TOOLBAR_COLOR_OPTIONS,
];

export const BLOCK_TYPES: BlockTypeConfig[] = [
  { type: 'paragraph', label: 'Paragraph', icon: 'text' },
  { type: 'heading1', label: 'Heading 1', icon: 'h1' },
  { type: 'heading2', label: 'Heading 2', icon: 'h2' },
  { type: 'heading3', label: 'Heading 3', icon: 'h3' },
  { type: 'heading4', label: 'Heading 4', icon: 'h4' },
  { type: 'heading5', label: 'Heading 5', icon: 'h5' },
  { type: 'heading6', label: 'Heading 6', icon: 'h6' },
  { type: 'bulletList', label: 'Bullet List', icon: 'list' },
  { type: 'orderedList', label: 'Numbered List', icon: 'listOrdered' },
  { type: 'taskList', label: 'Task List', icon: 'listCheck' },
  { type: 'blockquote', label: 'Quote', icon: 'quote' },
  { type: 'codeBlock', label: 'Code Block', icon: 'code' },
];

export function computeToolbarVisibility(from: number, to: number): boolean {
  return from !== to;
}

export function computeToolbarPlacement(
  selectionBottom: number,
  viewportBottom: number
): 'top' | 'bottom' {
  const spaceBelow = viewportBottom - selectionBottom;
  return spaceBelow < 60 ? 'top' : 'bottom';
}

export function isValidUrl(input: string): boolean {
  if (!input || input.trim() === '') return false;
  
  const trimmed = input.trim();
  if (trimmed !== input) return false;

  const validPatterns = [
    /^https?:\/\/.+/i,
    /^mailto:.+/i,
    /^\/.+/,
  ];
  
  return validPatterns.some(pattern => pattern.test(trimmed));
}

export function getBlockTypeLabel(blockType: BlockType): string {
  const config = BLOCK_TYPES.find(b => b.type === blockType);
  return config?.label || 'Paragraph';
}

export function isMarkActive(activeMarks: Set<string>, markName: string): boolean {
  return activeMarks.has(markName);
}

export function getColorById(id: string, isDark: boolean = false): ColorOption | undefined {
  const palette = isDark ? COLOR_PALETTE_DARK : COLOR_PALETTE;
  return palette.find(c => c.id === id);
}
