/**
 * Drag Handle - Block drag and menu trigger
 */

import React, { useState, useCallback } from 'react';
import { useEditorContext } from '../EditorContext';
import { useEditorStore } from '../EditorStore';
import {
  GripVertical,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export function DragHandle() {
  const { dragHandle, setDragHandle } = useEditorContext();
  const { duplicateBlock, deleteBlock, moveBlock, blocks } = useEditorStore();
  const [showMenu, setShowMenu] = useState(false);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!dragHandle.blockId) return;
    e.dataTransfer.setData('text/plain', dragHandle.blockId);
    e.dataTransfer.effectAllowed = 'move';
  }, [dragHandle.blockId]);

  const handleClick = useCallback(() => {
    setShowMenu((prev) => !prev);
  }, []);

  const handleDuplicate = useCallback(() => {
    if (!dragHandle.blockId) return;
    duplicateBlock(dragHandle.blockId);
    setShowMenu(false);
  }, [dragHandle.blockId, duplicateBlock]);

  const handleDelete = useCallback(() => {
    if (!dragHandle.blockId) return;
    deleteBlock(dragHandle.blockId);
    setShowMenu(false);
    setDragHandle((prev) => ({ ...prev, isVisible: false }));
  }, [dragHandle.blockId, deleteBlock, setDragHandle]);

  const handleMoveUp = useCallback(() => {
    if (!dragHandle.blockId) return;
    const index = blocks.findIndex((b) => b.id === dragHandle.blockId);
    if (index > 0) {
      moveBlock(dragHandle.blockId, blocks[index - 1].id, 'before');
    }
    setShowMenu(false);
  }, [dragHandle.blockId, blocks, moveBlock]);

  const handleMoveDown = useCallback(() => {
    if (!dragHandle.blockId) return;
    const index = blocks.findIndex((b) => b.id === dragHandle.blockId);
    if (index < blocks.length - 1) {
      moveBlock(dragHandle.blockId, blocks[index + 1].id, 'after');
    }
    setShowMenu(false);
  }, [dragHandle.blockId, blocks, moveBlock]);

  return (
    <>
      <div
        className="drag-handle"
        style={{
          left: dragHandle.position.x,
          top: dragHandle.position.y,
        }}
        draggable
        onDragStart={handleDragStart}
        onClick={handleClick}
      >
        <GripVertical size={16} />
      </div>

      {showMenu && (
        <div
          className="drag-handle-menu"
          style={{
            left: dragHandle.position.x - 120,
            top: dragHandle.position.y + 24,
          }}
        >
          <button className="drag-handle-menu-item" onClick={handleDuplicate}>
            <Copy size={14} />
            <span>Duplicate</span>
          </button>
          <button className="drag-handle-menu-item" onClick={handleMoveUp}>
            <ArrowUp size={14} />
            <span>Move up</span>
          </button>
          <button className="drag-handle-menu-item" onClick={handleMoveDown}>
            <ArrowDown size={14} />
            <span>Move down</span>
          </button>
          <div className="drag-handle-menu-divider" />
          <button className="drag-handle-menu-item danger" onClick={handleDelete}>
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </>
  );
}
