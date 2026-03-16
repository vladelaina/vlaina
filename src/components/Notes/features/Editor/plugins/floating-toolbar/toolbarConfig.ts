import { EDITOR_ICONS } from '@/components/ui/icons/editor-svgs';

export interface ToolbarButtonConfig {
  action: string;
  icon: string;
  tooltip: string;
  shortcut?: string;
  mark?: string;
}

export type ToolbarLayout = 'default' | 'codeBlock';
export type ToolbarGroupKey = 'ai' | 'block' | 'alignment' | 'format' | 'linkColor' | 'copyDelete';

export const FORMAT_BUTTONS: ToolbarButtonConfig[] = [
  { action: 'bold', icon: EDITOR_ICONS.bold, tooltip: 'Bold', shortcut: 'Ctrl+B', mark: 'strong' },
  { action: 'italic', icon: EDITOR_ICONS.italic, tooltip: 'Italic', shortcut: 'Ctrl+I', mark: 'emphasis' },
  { action: 'underline', icon: EDITOR_ICONS.underline, tooltip: 'Underline', shortcut: 'Ctrl+U', mark: 'underline' },
  { action: 'strike', icon: EDITOR_ICONS.strike, tooltip: 'Strikethrough', shortcut: 'Ctrl+Shift+X', mark: 'strike_through' },
  { action: 'code', icon: EDITOR_ICONS.code, tooltip: 'Inline Code', shortcut: 'Ctrl+E', mark: 'inlineCode' },
  { action: 'highlight', icon: EDITOR_ICONS.highlight, tooltip: 'Highlight', shortcut: 'Ctrl+H', mark: 'highlight' },
];

export const EXTRA_BUTTONS: ToolbarButtonConfig[] = [
  { action: 'link', icon: EDITOR_ICONS.link, tooltip: 'Add Link', shortcut: 'Ctrl+K' },
  { action: 'color', icon: EDITOR_ICONS.color, tooltip: 'Text Color' },
  { action: 'copy', icon: EDITOR_ICONS.copy, tooltip: 'Copy' },
  { action: 'delete', icon: EDITOR_ICONS.trash, tooltip: 'Delete' },
];

export const TOOLBAR_LAYOUTS: Record<ToolbarLayout, ToolbarGroupKey[]> = {
  default: ['ai', 'block', 'alignment', 'format', 'linkColor', 'copyDelete'],
  codeBlock: ['ai', 'block', 'copyDelete'],
};
