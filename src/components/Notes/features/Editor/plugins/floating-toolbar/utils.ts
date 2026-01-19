// Floating Toolbar Utility Functions
import type { ColorOption, BlockTypeConfig, BlockType } from './types';
import { COLOR_DEFINITIONS, getEventInlineStyles } from '@/lib/colors/index';

// Helper to capitalize labels
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Color palette for light mode
export const COLOR_PALETTE: ColorOption[] = [
  { id: 'default', label: 'Default' }, // Reset option
  ...COLOR_DEFINITIONS.map(def => {
    const styles = getEventInlineStyles(def.name);
    return {
      id: def.name === 'default' ? 'gray' : def.name,
      label: capitalize(def.name === 'default' ? 'Gray' : def.name), // Map 'default' color to 'Gray' label to avoid confusion with reset
      textColor: styles.text,
      bgColor: styles.bg,
    };
  })
];

// Color palette for dark mode
export const COLOR_PALETTE_DARK: ColorOption[] = [
  { id: 'default', label: 'Default' }, // Reset option
  ...COLOR_DEFINITIONS.map(def => {
    const styles = getEventInlineStyles(def.name);
    return {
      id: def.name === 'default' ? 'gray' : def.name,
      label: capitalize(def.name === 'default' ? 'Gray' : def.name),
      textColor: styles.textDark,
      bgColor: styles.bgDark,
    };
  })
];

// Block type configurations
export const BLOCK_TYPES: BlockTypeConfig[] = [
  { type: 'paragraph', label: 'Paragraph', icon: 'text' },
  { type: 'heading1', label: 'Heading 1', icon: 'h1' },
  { type: 'heading2', label: 'Heading 2', icon: 'h2' },
  { type: 'heading3', label: 'Heading 3', icon: 'h3' },
  { type: 'heading4', label: 'Heading 4', icon: 'h4' },
  { type: 'heading5', label: 'Heading 5', icon: 'h5' },
  { type: 'heading6', label: 'Heading 6', icon: 'h6' },
  { type: 'blockquote', label: 'Quote', icon: 'quote' },
  { type: 'bulletList', label: 'Bullet List', icon: 'list' },
  { type: 'orderedList', label: 'Numbered List', icon: 'listOrdered' },
  { type: 'taskList', label: 'Task List', icon: 'listCheck' },
  { type: 'codeBlock', label: 'Code Block', icon: 'code' },
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
  ];
  
  return validPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Get block type label for display
 */
export function getBlockTypeLabel(blockType: BlockType): string {
  const config = BLOCK_TYPES.find(b => b.type === blockType);
  return config?.label || 'Paragraph';
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
