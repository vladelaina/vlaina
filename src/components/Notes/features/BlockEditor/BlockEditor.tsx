/**
 * Block Editor - Main editor component
 * 
 * A modern block-based editor with slash commands, drag handles, and inline formatting
 */

import React, { useState, useCallback } from 'react';
import { EditorProvider, useEditorContext } from './EditorContext';
import { BlockRenderer } from './blocks';
import { SlashMenu, DragHandle, InlineToolbar, LinkSuggest, KeyboardShortcutsModal } from './widgets';
import { useEditorStore } from './EditorStore';
import { cn } from '@/lib/utils';
import { IconKeyboard } from '@tabler/icons-react';
import './styles.css';

interface BlockEditorInnerProps {
  className?: string;
}

function BlockEditorInner({ className }: BlockEditorInnerProps) {
  const { editorRef, blocks, slashMenu, dragHandle, inlineToolbar, linkSuggest, setLinkSuggest } = useEditorContext();
  const { moveBlock } = useEditorStore();
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('after');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Find the closest block element
    const target = e.target as HTMLElement;
    const blockWrapper = target.closest('[data-block-id]') as HTMLElement;
    
    if (blockWrapper) {
      const blockId = blockWrapper.dataset.blockId;
      const rect = blockWrapper.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? 'before' : 'after';
      
      setDropTargetId(blockId || null);
      setDropPosition(position);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const draggedBlockId = e.dataTransfer.getData('text/plain');
    
    if (draggedBlockId && dropTargetId && draggedBlockId !== dropTargetId) {
      moveBlock(draggedBlockId, dropTargetId, dropPosition);
    }
    
    setDropTargetId(null);
  }, [dropTargetId, dropPosition, moveBlock]);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDropTargetId(null);
  }, []);

  return (
    <div
      ref={editorRef}
      className={cn('block-editor', className)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      <div className="block-editor-content">
        {blocks.map((block) => (
          <div
            key={block.id}
            className={cn(
              dropTargetId === block.id && 'drop-target',
              dropTargetId === block.id && dropPosition === 'before' && 'drop-before',
              dropTargetId === block.id && dropPosition === 'after' && 'drop-after'
            )}
          >
            <BlockRenderer block={block} />
          </div>
        ))}
      </div>

      {/* Slash Menu */}
      {slashMenu.isOpen && <SlashMenu />}

      {/* Drag Handle */}
      {dragHandle.isVisible && <DragHandle />}

      {/* Inline Toolbar */}
      {inlineToolbar.isVisible && <InlineToolbar />}

      {/* Link Suggest */}
      {linkSuggest.isOpen && (
        <LinkSuggest
          isOpen={linkSuggest.isOpen}
          position={linkSuggest.position}
          searchText={linkSuggest.searchText}
          notes={[]} // TODO: Pass actual notes from parent
          onSelect={(note) => {
            // TODO: Insert wiki link
            console.log('Selected note:', note);
            setLinkSuggest(prev => ({ ...prev, isOpen: false }));
          }}
          onCreate={(title) => {
            // TODO: Create new note and insert link
            console.log('Create note:', title);
            setLinkSuggest(prev => ({ ...prev, isOpen: false }));
          }}
          onClose={() => setLinkSuggest(prev => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* Keyboard Shortcuts Button */}
      <button
        className="keyboard-shortcuts-btn"
        onClick={() => setShowShortcutsModal(true)}
        title="键盘快捷键"
      >
        <IconKeyboard size={18} />
      </button>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}

interface BlockEditorProps {
  initialContent?: string;
  onChange?: (markdown: string) => void;
  className?: string;
}

export function BlockEditor({ initialContent, onChange, className }: BlockEditorProps) {
  return (
    <EditorProvider initialContent={initialContent} onChange={onChange}>
      <BlockEditorInner className={className} />
    </EditorProvider>
  );
}
