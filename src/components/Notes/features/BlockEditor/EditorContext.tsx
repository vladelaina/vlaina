/**
 * Editor Context - Provides editor state and methods to child components
 */

import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { useEditorStore } from './EditorStore';
import type { Block, BlockType, BlockSelection, SlashMenuState, DragHandleState, InlineToolbarState, LinkSuggestState } from './types';
import { markdownToBlocks, blocksToMarkdown, createBlock, getPreviousBlock, getNextBlock, getDeltaLength, checkInlineMarkdown, applyInlineMarkdownFormat } from './utils';

interface EditorContextValue {
  // Refs
  editorRef: React.RefObject<HTMLDivElement | null>;
  blockRefs: Map<string, HTMLDivElement>;
  
  // State
  blocks: Block[];
  selection: BlockSelection | null;
  focusedBlockId: string | null;
  isComposing: boolean;
  
  // Slash menu
  slashMenu: SlashMenuState;
  setSlashMenu: React.Dispatch<React.SetStateAction<SlashMenuState>>;
  
  // Drag handle
  dragHandle: DragHandleState;
  setDragHandle: React.Dispatch<React.SetStateAction<DragHandleState>>;
  
  // Inline toolbar
  inlineToolbar: InlineToolbarState;
  setInlineToolbar: React.Dispatch<React.SetStateAction<InlineToolbarState>>;
  
  // Link suggest
  linkSuggest: LinkSuggestState;
  setLinkSuggest: React.Dispatch<React.SetStateAction<LinkSuggestState>>;
  
  // Methods
  registerBlockRef: (id: string, ref: HTMLDivElement | null) => void;
  focusBlock: (id: string, position?: 'start' | 'end' | number) => void;
  handleKeyDown: (e: React.KeyboardEvent, blockId: string) => void;
  handleInput: (blockId: string, content: string) => void;
  handleBlockTypeChange: (blockId: string, newType: BlockType) => void;
  updateBlockProps: (blockId: string, props: Record<string, unknown>) => void;
  
  // Content
  loadContent: (markdown: string) => void;
  getContent: () => string;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorContext must be used within EditorProvider');
  }
  return context;
}

interface EditorProviderProps {
  children: React.ReactNode;
  initialContent?: string;
  onChange?: (markdown: string) => void;
}

export function EditorProvider({ children, initialContent, onChange }: EditorProviderProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const blockRefsMap = useRef(new Map<string, HTMLDivElement>());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Zustand store
  const {
    blocks,
    selection,
    focusedBlockId,
    isComposing,
    setBlocks,
    insertBlock,
    updateBlock,
    splitBlock,
    mergeBlocks,
    convertBlock,
    setFocusedBlock,
    indentBlock,
    dedentBlock,
    undo,
    redo,
    captureHistory,
  } = useEditorStore();

  // UI state
  const [slashMenu, setSlashMenu] = React.useState<SlashMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    searchText: '',
    selectedIndex: 0,
    triggerBlockId: null,
  });

  const [dragHandle, setDragHandle] = React.useState<DragHandleState>({
    isVisible: false,
    blockId: null,
    position: { x: 0, y: 0 },
  });

  const [inlineToolbar, setInlineToolbar] = React.useState<InlineToolbarState>({
    isVisible: false,
    position: { x: 0, y: 0 },
    activeFormats: new Set(),
  });

  const [linkSuggest, setLinkSuggest] = React.useState<LinkSuggestState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    searchText: '',
    triggerBlockId: null,
  });

  // Register block ref
  const registerBlockRef = useCallback((id: string, ref: HTMLDivElement | null) => {
    if (ref) {
      blockRefsMap.current.set(id, ref);
    } else {
      blockRefsMap.current.delete(id);
    }
  }, []);

  // Focus a block
  const focusBlock = useCallback((id: string, position: 'start' | 'end' | number = 'end') => {
    const blockRef = blockRefsMap.current.get(id);
    if (!blockRef) return;

    const editableEl = blockRef.querySelector('[contenteditable="true"]') as HTMLElement;
    if (!editableEl) return;

    editableEl.focus();
    setFocusedBlock(id);

    // Set cursor position
    const range = document.createRange();
    const sel = window.getSelection();
    
    if (position === 'start') {
      range.setStart(editableEl, 0);
      range.collapse(true);
    } else if (position === 'end') {
      range.selectNodeContents(editableEl);
      range.collapse(false);
    } else {
      // Specific position - simplified for now
      range.selectNodeContents(editableEl);
      range.collapse(position === 0);
    }

    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [setFocusedBlock]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent, blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    // Redo with Ctrl+Y
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      redo();
      return;
    }

    // Tab key for list indentation
    if (e.key === 'Tab') {
      const isListBlock = ['bulletList', 'numberedList', 'todoList'].includes(block.type);
      if (isListBlock) {
        e.preventDefault();
        if (e.shiftKey) {
          dedentBlock(blockId);
        } else {
          indentBlock(blockId);
        }
        return;
      }
    }

    // Ctrl+D to duplicate block
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      const { duplicateBlock } = useEditorStore.getState();
      duplicateBlock(blockId);
      return;
    }

    // Ctrl+Shift+Up to move block up
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault();
      const index = blocks.findIndex(b => b.id === blockId);
      if (index > 0) {
        const { moveBlock } = useEditorStore.getState();
        moveBlock(blockId, blocks[index - 1].id, 'before');
      }
      return;
    }

    // Ctrl+Shift+Down to move block down
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault();
      const index = blocks.findIndex(b => b.id === blockId);
      if (index < blocks.length - 1) {
        const { moveBlock } = useEditorStore.getState();
        moveBlock(blockId, blocks[index + 1].id, 'after');
      }
      return;
    }

    // Enter key
    if (e.key === 'Enter' && !e.shiftKey) {
      // Don't handle if slash menu is open
      if (slashMenu.isOpen) return;
      
      e.preventDefault();
      
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const blockRef = blockRefsMap.current.get(blockId);
      if (!blockRef) return;

      const editableEl = blockRef.querySelector('[contenteditable="true"]');
      if (!editableEl) return;

      // Get cursor position
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editableEl);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      const cursorPosition = preCaretRange.toString().length;

      const textLength = getDeltaLength(block.content);

      if (cursorPosition === textLength) {
        // At end - create new block
        const newBlock = createBlock('paragraph');
        insertBlock(newBlock, blockId);
        setTimeout(() => focusBlock(newBlock.id, 'start'), 0);
      } else {
        // In middle - split block
        splitBlock(blockId, cursorPosition);
      }
      return;
    }

    // Backspace at start
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      if (!range.collapsed) return; // Has selection, let default handle

      const blockRef = blockRefsMap.current.get(blockId);
      if (!blockRef) return;

      const editableEl = blockRef.querySelector('[contenteditable="true"]');
      if (!editableEl) return;

      // Check if at start
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editableEl);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      const cursorPosition = preCaretRange.toString().length;

      if (cursorPosition === 0) {
        e.preventDefault();

        // If not paragraph, convert to paragraph first
        if (block.type !== 'paragraph') {
          convertBlock(blockId, 'paragraph');
          return;
        }

        // Merge with previous block
        const prevBlock = getPreviousBlock(blocks, blockId);
        if (prevBlock && prevBlock.type !== 'divider') {
          mergeBlocks(blockId, prevBlock.id);
          setTimeout(() => focusBlock(prevBlock.id, 'end'), 0);
        }
      }
      return;
    }

    // Arrow up at start
    if (e.key === 'ArrowUp') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const blockRef = blockRefsMap.current.get(blockId);
      if (!blockRef) return;

      const editableEl = blockRef.querySelector('[contenteditable="true"]');
      if (!editableEl) return;

      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editableEl);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      const cursorPosition = preCaretRange.toString().length;

      if (cursorPosition === 0) {
        e.preventDefault();
        const prevBlock = getPreviousBlock(blocks, blockId);
        if (prevBlock) {
          focusBlock(prevBlock.id, 'end');
        }
      }
      return;
    }

    // Arrow down at end
    if (e.key === 'ArrowDown') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const blockRef = blockRefsMap.current.get(blockId);
      if (!blockRef) return;

      const editableEl = blockRef.querySelector('[contenteditable="true"]');
      if (!editableEl) return;

      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editableEl);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      const cursorPosition = preCaretRange.toString().length;
      const textLength = getDeltaLength(block.content);

      if (cursorPosition === textLength) {
        e.preventDefault();
        const nextBlock = getNextBlock(blocks, blockId);
        if (nextBlock) {
          focusBlock(nextBlock.id, 'start');
        }
      }
      return;
    }
  }, [blocks, slashMenu.isOpen, insertBlock, splitBlock, convertBlock, mergeBlocks, focusBlock, undo, redo]);

  // Handle input
  const handleInput = useCallback((blockId: string, content: string) => {
    // Check for inline markdown shortcuts
    const inlineMatch = checkInlineMarkdown(content);
    if (inlineMatch) {
      // Apply inline format
      const newDelta = applyInlineMarkdownFormat([{ insert: content }], inlineMatch);
      updateBlock(blockId, { content: newDelta });
      captureHistory();
      
      // Notify parent of changes
      if (onChangeRef.current) {
        const markdown = blocksToMarkdown(useEditorStore.getState().blocks);
        onChangeRef.current(markdown);
      }
      return;
    }
    
    updateBlock(blockId, { content: [{ insert: content }] });
    
    // Notify parent of changes
    if (onChangeRef.current) {
      const markdown = blocksToMarkdown(useEditorStore.getState().blocks);
      onChangeRef.current(markdown);
    }
  }, [updateBlock, captureHistory]);

  // Handle block type change
  const handleBlockTypeChange = useCallback((blockId: string, newType: BlockType) => {
    convertBlock(blockId, newType);
    captureHistory();
  }, [convertBlock, captureHistory]);

  // Update block props
  const updateBlockProps = useCallback((blockId: string, props: Record<string, unknown>) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    updateBlock(blockId, {
      props: { ...block.props, ...props },
    });
    captureHistory();
  }, [blocks, updateBlock, captureHistory]);

  // Load content
  const loadContent = useCallback((markdown: string) => {
    const newBlocks = markdownToBlocks(markdown);
    setBlocks(newBlocks);
  }, [setBlocks]);

  // Get content
  const getContent = useCallback(() => {
    return blocksToMarkdown(blocks);
  }, [blocks]);

  // Initialize with content
  useEffect(() => {
    if (initialContent) {
      loadContent(initialContent);
    }
  }, []);

  // Text selection detection for inline toolbar
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setInlineToolbar(prev => ({ ...prev, isVisible: false }));
        return;
      }

      const range = sel.getRangeAt(0);
      const selectedText = sel.toString().trim();
      
      if (!selectedText) {
        setInlineToolbar(prev => ({ ...prev, isVisible: false }));
        return;
      }

      // Check if selection is within editor
      if (!editorRef.current?.contains(range.commonAncestorContainer)) {
        setInlineToolbar(prev => ({ ...prev, isVisible: false }));
        return;
      }

      // Get selection rect
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();

      // Position toolbar above selection
      const x = rect.left + rect.width / 2 - 100; // Center toolbar
      const y = rect.top - 44; // Above selection

      setInlineToolbar({
        isVisible: true,
        position: { x: Math.max(editorRect.left, x), y: Math.max(editorRect.top, y) },
        activeFormats: new Set(), // TODO: detect active formats
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const value: EditorContextValue = {
    editorRef,
    blockRefs: blockRefsMap.current,
    blocks,
    selection,
    focusedBlockId,
    isComposing,
    slashMenu,
    setSlashMenu,
    dragHandle,
    setDragHandle,
    inlineToolbar,
    setInlineToolbar,
    linkSuggest,
    setLinkSuggest,
    registerBlockRef,
    focusBlock,
    handleKeyDown,
    handleInput,
    handleBlockTypeChange,
    updateBlockProps,
    loadContent,
    getContent,
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}
