// Floating Toolbar Utility Functions
import type { ColorOption, BlockTypeConfig, BlockType } from './types';

// Color palette for light mode
export const COLOR_PALETTE: ColorOption[] = [
  { id: 'default', label: '默认' },
  { id: 'gray', label: '灰色', textColor: '#6b7280', bgColor: '#f3f4f6' },
  { id: 'red', label: '红色', textColor: '#dc2626', bgColor: '#fef2f2' },
  { id: 'orange', label: '橙色', textColor: '#ea580c', bgColor: '#fff7ed' },
  { id: 'yellow', label: '黄色', textColor: '#ca8a04', bgColor: '#fefce8' },
  { id: 'green', label: '绿色', textColor: '#16a34a', bgColor: '#f0fdf4' },
  { id: 'blue', label: '蓝色', textColor: '#2563eb', bgColor: '#eff6ff' },
  { id: 'purple', label: '紫色', textColor: '#9333ea', bgColor: '#faf5ff' },
  { id: 'pink', label: '粉色', textColor: '#db2777', bgColor: '#fdf2f8' },
];

// Color palette for dark mode
export const COLOR_PALETTE_DARK: ColorOption[] = [
  { id: 'default', label: '默认' },
  { id: 'gray', label: '灰色', textColor: '#9ca3af', bgColor: '#374151' },
  { id: 'red', label: '红色', textColor: '#f87171', bgColor: '#450a0a' },
  { id: 'orange', label: '橙色', textColor: '#fb923c', bgColor: '#431407' },
  { id: 'yellow', label: '黄色', textColor: '#facc15', bgColor: '#422006' },
  { id: 'green', label: '绿色', textColor: '#4ade80', bgColor: '#052e16' },
  { id: 'blue', label: '蓝色', textColor: '#60a5fa', bgColor: '#172554' },
  { id: 'purple', label: '紫色', textColor: '#c084fc', bgColor: '#3b0764' },
  { id: 'pink', label: '粉色', textColor: '#f472b6', bgColor: '#500724' },
];

// Block type configurations
export const BLOCK_TYPES: BlockTypeConfig[] = [
  { type: 'paragraph', label: '正文', icon: 'text' },
  { type: 'heading1', label: '标题 1', icon: 'h1', shortcut: 'Ctrl+Alt+1' },
  { type: 'heading2', label: '标题 2', icon: 'h2', shortcut: 'Ctrl+Alt+2' },
  { type: 'heading3', label: '标题 3', icon: 'h3', shortcut: 'Ctrl+Alt+3' },
  { type: 'heading4', label: '标题 4', icon: 'h4' },
  { type: 'heading5', label: '标题 5', icon: 'h5' },
  { type: 'heading6', label: '标题 6', icon: 'h6' },
  { type: 'blockquote', label: '引用', icon: 'quote' },
  { type: 'bulletList', label: '无序列表', icon: 'list' },
  { type: 'orderedList', label: '有序列表', icon: 'listOrdered' },
  { type: 'taskList', label: '任务列表', icon: 'listCheck' },
  { type: 'codeBlock', label: '代码块', icon: 'code' },
];

/**
 * Compute toolbar visibility based on selection state
 * Property 1: Toolbar should be visible iff selection is non-empty
 */
export function computeToolbarVisibility(from: number, to: number): boolean {
  return from !== to;
}

/**
 * Compute toolbar placement based on selection position
 * Property 2: If selection top is within 60px of viewport top, place below
 */
export function computeToolbarPlacement(
  selectionTop: number,
  viewportTop: number = 0
): 'top' | 'bottom' {
  const distanceFromTop = selectionTop - viewportTop;
  return distanceFromTop < 60 ? 'bottom' : 'top';
}

/**
 * Validate URL format
 * Property 7: Valid URLs match http://, https://, mailto:, or relative path starting with /
 */
export function isValidUrl(input: string): boolean {
  if (!input || input.trim() === '') return false;
  
  const trimmed = input.trim();
  
  // Check for valid URL patterns
  const validPatterns = [
    /^https?:\/\/.+/i,  // http:// or https://
    /^mailto:.+/i,       // mailto:
    /^\/.+/,             // relative path starting with / followed by anything
    /^\[\[.+\]\]$/,      // wiki link format [[...]]
  ];
  
  return validPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Get block type label for display
 */
export function getBlockTypeLabel(blockType: BlockType): string {
  const config = BLOCK_TYPES.find(b => b.type === blockType);
  return config?.label || '正文';
}

/**
 * Check if a mark is active in the given marks set
 */
export function isMarkActive(activeMarks: Set<string>, markName: string): boolean {
  return activeMarks.has(markName);
}

/**
 * Get color option by ID
 */
export function getColorById(id: string, isDark: boolean = false): ColorOption | undefined {
  const palette = isDark ? COLOR_PALETTE_DARK : COLOR_PALETTE;
  return palette.find(c => c.id === id);
}
