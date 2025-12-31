/**
 * Block Editor Type Definitions
 */

// Block types supported by the editor
export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'bulletList'
  | 'numberedList'
  | 'todoList'
  | 'codeBlock'
  | 'quote'
  | 'divider'
  | 'callout';

// Inline format types
export type InlineFormat =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'code'
  | 'link';

// Text range for selections
export interface TextRange {
  index: number;
  length: number;
}

// Inline text attributes
export interface TextAttributes {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;  // strikethrough
  code?: boolean;
  link?: string;
}

// Delta operation for text content
export interface DeltaInsert {
  insert: string;
  attributes?: TextAttributes;
}

// Block properties
export interface BlockProps {
  // Heading
  collapsed?: boolean;
  // List
  checked?: boolean;
  indent?: number;  // Indentation level for lists
  // Code
  language?: string;
  // Callout
  calloutType?: 'note' | 'warning' | 'tip' | 'danger';
  // Text alignment
  textAlign?: 'left' | 'center' | 'right';
}

// Block data structure
export interface Block {
  id: string;
  type: BlockType;
  content: DeltaInsert[];
  children: Block[];
  props: BlockProps;
}

// Selection state
export interface BlockSelection {
  blockId: string;
  range: TextRange | null;
  isCollapsed: boolean;
}

// Editor state
export interface EditorState {
  blocks: Block[];
  selection: BlockSelection | null;
  selectedBlockIds: string[];
  focusedBlockId: string | null;
  isDragging: boolean;
  isComposing: boolean;
}

// History entry
export interface HistoryEntry {
  blocks: Block[];
  selection: BlockSelection | null;
  timestamp: number;
}

// Slash command
export interface SlashCommand {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: 'basic' | 'media' | 'advanced' | 'embed' | 'tools';
  shortcut?: string;
  keywords?: string[];
  action: () => void;
}

// Slash menu state
export interface SlashMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  searchText: string;
  selectedIndex: number;
  triggerBlockId: string | null;
}

// Drag handle state
export interface DragHandleState {
  isVisible: boolean;
  blockId: string | null;
  position: { x: number; y: number };
}

// Inline toolbar state
export interface InlineToolbarState {
  isVisible: boolean;
  position: { x: number; y: number };
  activeFormats: Set<InlineFormat>;
}

// Link suggest state
export interface LinkSuggestState {
  isOpen: boolean;
  position: { x: number; y: number };
  searchText: string;
  triggerBlockId: string | null;
}

// Placeholder config
export const PLACEHOLDERS: Record<BlockType, string> = {
  paragraph: "Type '/' for commands",
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  heading4: 'Heading 4',
  heading5: 'Heading 5',
  heading6: 'Heading 6',
  bulletList: 'List item',
  numberedList: 'List item',
  todoList: 'To-do',
  codeBlock: 'Enter code...',
  quote: 'Quote',
  divider: '',
  callout: 'Callout',
};
