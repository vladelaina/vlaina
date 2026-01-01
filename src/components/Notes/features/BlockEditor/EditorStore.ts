/**
 * Editor Store - State management for Block Editor
 * 
 * Implements undo/redo history and block operations
 */

import { create } from 'zustand';
import type {
  Block,
  BlockType,
  BlockSelection,
  EditorState,
  HistoryEntry,
  InlineFormat,
} from './types';
import {
  createBlock,
  cloneBlocks,
  findBlockIndex,
  splitDelta,
  mergeDelta,
  getDeltaLength,
  applyFormat,
} from './utils';

const MAX_HISTORY_SIZE = 100;

interface EditorStore extends EditorState {
  // History
  history: HistoryEntry[];
  historyIndex: number;

  // Actions
  setBlocks: (blocks: Block[]) => void;
  insertBlock: (block: Block, afterId?: string) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  deleteBlock: (id: string) => void;
  moveBlock: (id: string, targetId: string, position: 'before' | 'after') => void;
  splitBlock: (id: string, position: number) => void;
  mergeBlocks: (sourceId: string, targetId: string) => void;
  convertBlock: (id: string, newType: BlockType) => void;
  duplicateBlock: (id: string) => void;
  indentBlock: (id: string) => void;
  dedentBlock: (id: string) => void;

  // Selection
  setSelection: (selection: BlockSelection | null) => void;
  setFocusedBlock: (id: string | null) => void;
  selectBlocks: (ids: string[]) => void;
  clearSelection: () => void;

  // Formatting
  applyInlineFormat: (format: InlineFormat, value?: boolean | string) => void;

  // Composing
  setComposing: (isComposing: boolean) => void;

  // Dragging
  setDragging: (isDragging: boolean) => void;

  // History
  undo: () => void;
  redo: () => void;
  captureHistory: () => void;

  // Reset
  reset: () => void;
}

const initialState: EditorState = {
  blocks: [createBlock('paragraph')],
  selection: null,
  selectedBlockIds: [],
  focusedBlockId: null,
  isDragging: false,
  isComposing: false,
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...initialState,
  history: [],
  historyIndex: -1,

  setBlocks: (blocks) => {
    set({ blocks });
    get().captureHistory();
  },

  insertBlock: (block, afterId) => {
    set((state) => {
      const blocks = [...state.blocks];
      if (afterId) {
        const index = findBlockIndex(blocks, afterId);
        if (index !== -1) {
          blocks.splice(index + 1, 0, block);
        } else {
          blocks.push(block);
        }
      } else {
        blocks.push(block);
      }
      return { blocks };
    });
    get().captureHistory();
  },

  updateBlock: (id, updates) => {
    set((state) => {
      const blocks = state.blocks.map((block) =>
        block.id === id ? { ...block, ...updates } : block
      );
      return { blocks };
    });
  },

  deleteBlock: (id) => {
    set((state) => {
      let blocks = state.blocks.filter((block) => block.id !== id);
      // Ensure at least one block exists
      if (blocks.length === 0) {
        blocks = [createBlock('paragraph')];
      }
      return { blocks };
    });
    get().captureHistory();
  },

  moveBlock: (id, targetId, position) => {
    set((state) => {
      const blocks = [...state.blocks];
      const sourceIndex = findBlockIndex(blocks, id);
      const targetIndex = findBlockIndex(blocks, targetId);

      if (sourceIndex === -1 || targetIndex === -1) return state;

      const [block] = blocks.splice(sourceIndex, 1);
      const insertIndex =
        position === 'before'
          ? targetIndex > sourceIndex
            ? targetIndex - 1
            : targetIndex
          : targetIndex > sourceIndex
          ? targetIndex
          : targetIndex + 1;

      blocks.splice(insertIndex, 0, block);
      return { blocks };
    });
    get().captureHistory();
  },

  splitBlock: (id, position) => {
    set((state) => {
      const blocks = [...state.blocks];
      const index = findBlockIndex(blocks, id);
      if (index === -1) return state;

      const block = blocks[index];
      const [beforeDelta, afterDelta] = splitDelta(block.content, position);

      // Update current block with content before cursor
      blocks[index] = {
        ...block,
        content: beforeDelta,
      };

      // Create new block with content after cursor
      const newBlock = createBlock('paragraph');
      newBlock.content = afterDelta;

      // Insert new block after current
      blocks.splice(index + 1, 0, newBlock);

      return {
        blocks,
        focusedBlockId: newBlock.id,
        selection: {
          blockId: newBlock.id,
          range: { index: 0, length: 0 },
          isCollapsed: true,
        },
      };
    });
    get().captureHistory();
  },

  mergeBlocks: (sourceId, targetId) => {
    set((state) => {
      const blocks = [...state.blocks];
      const sourceIndex = findBlockIndex(blocks, sourceId);
      const targetIndex = findBlockIndex(blocks, targetId);

      if (sourceIndex === -1 || targetIndex === -1) return state;

      const sourceBlock = blocks[sourceIndex];
      const targetBlock = blocks[targetIndex];

      // Get cursor position (end of target block)
      const cursorPosition = getDeltaLength(targetBlock.content);

      // Merge content
      const mergedContent = mergeDelta(targetBlock.content, sourceBlock.content);

      // Update target block
      blocks[targetIndex] = {
        ...targetBlock,
        content: mergedContent,
      };

      // Remove source block
      blocks.splice(sourceIndex, 1);

      return {
        blocks,
        focusedBlockId: targetId,
        selection: {
          blockId: targetId,
          range: { index: cursorPosition, length: 0 },
          isCollapsed: true,
        },
      };
    });
    get().captureHistory();
  },

  convertBlock: (id, newType) => {
    set((state) => {
      const blocks = state.blocks.map((block) =>
        block.id === id
          ? {
              ...block,
              type: newType,
              props: newType === 'todoList' ? { checked: false } : {},
            }
          : block
      );
      return { blocks };
    });
    get().captureHistory();
  },

  duplicateBlock: (id) => {
    set((state) => {
      const blocks = [...state.blocks];
      const index = findBlockIndex(blocks, id);
      if (index === -1) return state;

      const block = blocks[index];
      const newBlock: Block = {
        ...cloneBlocks([block])[0],
        id: createBlock().id,
      };

      blocks.splice(index + 1, 0, newBlock);
      return { blocks };
    });
    get().captureHistory();
  },

  indentBlock: (id) => {
    set((state) => {
      const blocks = state.blocks.map((block) => {
        if (block.id !== id) return block;
        
        // Only indent list blocks
        const isListBlock = ['bulletList', 'numberedList', 'todoList'].includes(block.type);
        if (!isListBlock) return block;
        
        const currentIndent = block.props.indent || 0;
        // Max indent level is 6
        if (currentIndent >= 6) return block;
        
        return {
          ...block,
          props: {
            ...block.props,
            indent: currentIndent + 1,
          },
        };
      });
      return { blocks };
    });
    get().captureHistory();
  },

  dedentBlock: (id) => {
    set((state) => {
      const blocks = state.blocks.map((block) => {
        if (block.id !== id) return block;
        
        // Only dedent list blocks
        const isListBlock = ['bulletList', 'numberedList', 'todoList'].includes(block.type);
        if (!isListBlock) return block;
        
        const currentIndent = block.props.indent || 0;
        if (currentIndent <= 0) return block;
        
        return {
          ...block,
          props: {
            ...block.props,
            indent: currentIndent - 1,
          },
        };
      });
      return { blocks };
    });
    get().captureHistory();
  },

  setSelection: (selection) => {
    set({ selection });
  },

  setFocusedBlock: (id) => {
    set({ focusedBlockId: id });
  },

  selectBlocks: (ids) => {
    set({ selectedBlockIds: ids });
  },

  clearSelection: () => {
    set({ selection: null, selectedBlockIds: [] });
  },

  applyInlineFormat: (format, value = true) => {
    const { selection } = get();
    if (!selection || !selection.range || selection.range.length === 0) return;

    set((state) => {
      const blocks = state.blocks.map((block) => {
        if (block.id !== selection.blockId) return block;
        return {
          ...block,
          content: applyFormat(block.content, selection.range!, format, value),
        };
      });
      return { blocks };
    });
    get().captureHistory();
  },

  setComposing: (isComposing) => {
    set({ isComposing });
  },

  setDragging: (isDragging) => {
    set({ isDragging });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    const entry = history[newIndex];

    set({
      blocks: cloneBlocks(entry.blocks),
      selection: entry.selection,
      historyIndex: newIndex,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    const entry = history[newIndex];

    set({
      blocks: cloneBlocks(entry.blocks),
      selection: entry.selection,
      historyIndex: newIndex,
    });
  },

  captureHistory: () => {
    const { blocks, selection, history, historyIndex } = get();

    // Remove any future history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);

    // Add new entry
    newHistory.push({
      blocks: cloneBlocks(blocks),
      selection,
      timestamp: Date.now(),
    });

    // Limit history size
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift();
    }

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  reset: () => {
    set({
      ...initialState,
      blocks: [createBlock('paragraph')],
      history: [],
      historyIndex: -1,
    });
  },
}));
