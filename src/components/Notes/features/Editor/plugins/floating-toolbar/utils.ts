import type { ColorOption, BlockTypeConfig, BlockType } from './types';
import { translate, type MessageKey } from '@/lib/i18n';
import { themeColorTokens } from '@/styles/themeTokens';
import { sanitizeEditorLinkHref } from '../links/utils/linkHref';

const TOOLBAR_COLOR_COLUMNS_PER_ROW = 4;
const VISIBLE_TRAILING_COLUMNS_PER_ROW = 2;

const TOOLBAR_COLOR_OPTIONS: ColorOption[] = themeColorTokens.toolbarColorHexes.map((color, index) => ({
  id: `custom-${index + 1}`,
  label: `Color ${index + 1}`,
  textColor: color,
  bgColor: color,
}));

const VISIBLE_TOOLBAR_COLOR_OPTIONS = TOOLBAR_COLOR_OPTIONS.filter((_color, index) => {
  const columnIndex = index % TOOLBAR_COLOR_COLUMNS_PER_ROW;
  return columnIndex >= TOOLBAR_COLOR_COLUMNS_PER_ROW - VISIBLE_TRAILING_COLUMNS_PER_ROW;
});

export const COLOR_PALETTE: ColorOption[] = [
  { id: 'default', label: 'Default' },
  ...VISIBLE_TOOLBAR_COLOR_OPTIONS,
];

export const COLOR_PALETTE_DARK: ColorOption[] = [
  { id: 'default', label: 'Default' },
  ...VISIBLE_TOOLBAR_COLOR_OPTIONS,
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
  return sanitizeEditorLinkHref(trimmed) !== null;
}

export function getBlockTypeLabel(blockType: BlockType): string {
  const config = BLOCK_TYPES.find(b => b.type === blockType);
  if (!config) return translate('editor.blockType.paragraph');
  return getLocalizedBlockTypeLabel(config.type);
}

export function getLocalizedBlockTypeLabel(blockType: BlockType): string {
  const labels: Record<BlockType, MessageKey> = {
    paragraph: 'editor.blockType.paragraph',
    heading1: 'editor.blockType.heading1',
    heading2: 'editor.blockType.heading2',
    heading3: 'editor.blockType.heading3',
    heading4: 'editor.blockType.heading4',
    heading5: 'editor.blockType.heading5',
    heading6: 'editor.blockType.heading6',
    bulletList: 'editor.blockType.bulletList',
    orderedList: 'editor.blockType.orderedList',
    taskList: 'editor.blockType.taskList',
    blockquote: 'editor.blockType.blockquote',
    codeBlock: 'editor.blockType.codeBlock',
  };
  return translate(labels[blockType]);
}

export function isMarkActive(activeMarks: Set<string>, markName: string): boolean {
  return activeMarks.has(markName);
}

export function getColorById(id: string, isDark: boolean = false): ColorOption | undefined {
  const palette = isDark ? COLOR_PALETTE_DARK : COLOR_PALETTE;
  return palette.find(c => c.id === id);
}
