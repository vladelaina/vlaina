/**
 * Block Renderer - Renders different block types
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorContext } from '../EditorContext';
import type { Block, DeltaInsert } from '../types';
import { PLACEHOLDERS } from '../types';
import { deltaToText, getDeltaLength, getBlockTypeFromPrefix } from '../utils';
import { cn } from '@/lib/utils';
import { CodeToolbar } from '../widgets/CodeToolbar';
import {
  IconH1,
  IconH2,
  IconH3,
  IconH4,
  IconH5,
  IconH6,
  IconSquare,
  IconSquareCheck,
} from '@tabler/icons-react';

interface BlockRendererProps {
  block: Block;
}

// Render delta content with formatting
function renderDeltaContent(delta: DeltaInsert[]): React.ReactNode {
  if (delta.length === 0) return null;
  
  return delta.map((d, index) => {
    let content: React.ReactNode = d.insert;
    
    if (d.attributes) {
      if (d.attributes.code) {
        content = <code key={`code-${index}`} className="inline-code">{content}</code>;
      }
      if (d.attributes.bold) {
        content = <strong key={`bold-${index}`}>{content}</strong>;
      }
      if (d.attributes.italic) {
        content = <em key={`italic-${index}`}>{content}</em>;
      }
      if (d.attributes.strike) {
        content = <s key={`strike-${index}`}>{content}</s>;
      }
      if (d.attributes.underline) {
        content = <u key={`underline-${index}`}>{content}</u>;
      }
      if (d.attributes.link) {
        content = (
          <a 
            key={`link-${index}`} 
            href={d.attributes.link as string}
            className="inline-link"
            onClick={(e) => {
              e.preventDefault();
              // TODO: Handle link click
            }}
          >
            {content}
          </a>
        );
      }
    }
    
    return <React.Fragment key={index}>{content}</React.Fragment>;
  });
}

export function BlockRenderer({ block }: BlockRendererProps) {
  const {
    registerBlockRef,
    focusedBlockId,
    handleKeyDown,
    handleInput,
    handleBlockTypeChange,
    updateBlockProps,
    setSlashMenu,
    setDragHandle,
    setLinkSuggest,
  } = useEditorContext();

  const blockRef = useRef<HTMLDivElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(getDeltaLength(block.content) === 0);
  const isFocused = focusedBlockId === block.id;

  // Register ref
  useEffect(() => {
    registerBlockRef(block.id, blockRef.current);
    return () => registerBlockRef(block.id, null);
  }, [block.id, registerBlockRef]);

  // Update isEmpty state
  useEffect(() => {
    setIsEmpty(getDeltaLength(block.content) === 0);
  }, [block.content]);

  // Handle input event
  const onInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const text = target.textContent || '';
    
    setIsEmpty(text.length === 0);

    // Check for markdown shortcuts at line start
    const spaceIndex = text.indexOf(' ');
    if (spaceIndex > 0 && spaceIndex <= 6) {
      const prefix = text.slice(0, spaceIndex);
      const newType = getBlockTypeFromPrefix(prefix);
      
      if (newType && newType !== block.type) {
        // Convert block type
        const remainingText = text.slice(spaceIndex + 1);
        handleBlockTypeChange(block.id, newType);
        
        // Update content without prefix
        setTimeout(() => {
          if (editableRef.current) {
            editableRef.current.textContent = remainingText;
            handleInput(block.id, remainingText);
            
            // Move cursor to end
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(editableRef.current);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
        }, 0);
        return;
      }
    }

    // Check for divider
    if (text === '---' || text === '***' || text === '___') {
      handleBlockTypeChange(block.id, 'divider');
      return;
    }

    // Check for wiki link trigger [[
    const wikiLinkMatch = text.match(/\[\[([^\]]*)?$/);
    if (wikiLinkMatch) {
      const rect = target.getBoundingClientRect();
      setLinkSuggest({
        isOpen: true,
        position: { x: rect.left, y: rect.bottom + 4 },
        searchText: wikiLinkMatch[1] || '',
        triggerBlockId: block.id,
      });
    } else {
      // Close link suggest if open
      setLinkSuggest(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
    }

    // Check for slash command
    if (text.endsWith('/') || (text.includes('/') && !text.includes(' '))) {
      const slashIndex = text.lastIndexOf('/');
      if (slashIndex === 0 || text[slashIndex - 1] === ' ') {
        // Open slash menu
        const rect = target.getBoundingClientRect();
        setSlashMenu({
          isOpen: true,
          position: { x: rect.left, y: rect.bottom + 4 },
          searchText: text.slice(slashIndex + 1),
          selectedIndex: 0,
          triggerBlockId: block.id,
        });
      }
    } else {
      // Close slash menu if open
      setSlashMenu(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
    }

    handleInput(block.id, text);
  }, [block.id, block.type, handleInput, handleBlockTypeChange, setSlashMenu, setLinkSuggest]);

  // Handle key down
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    handleKeyDown(e, block.id);
  }, [block.id, handleKeyDown]);

  // Handle mouse enter for drag handle
  const onMouseEnter = useCallback(() => {
    if (!blockRef.current) return;
    const rect = blockRef.current.getBoundingClientRect();
    setDragHandle({
      isVisible: true,
      blockId: block.id,
      position: { x: rect.left - 28, y: rect.top },
    });
  }, [block.id, setDragHandle]);

  // Handle mouse leave
  const onMouseLeave = useCallback(() => {
    setDragHandle(prev => ({ ...prev, isVisible: false }));
  }, [setDragHandle]);

  // Render based on block type
  const renderContent = () => {
    const text = deltaToText(block.content);
    const placeholder = PLACEHOLDERS[block.type];
    const hasFormatting = block.content.some(d => d.attributes && Object.keys(d.attributes).length > 0);

    switch (block.type) {
      case 'divider':
        return <hr className="block-divider" />;

      case 'codeBlock':
        return (
          <div className="block-code">
            <CodeToolbar
              language={block.props.language || 'plain'}
              code={text}
              onLanguageChange={(lang) => updateBlockProps(block.id, { language: lang })}
            />
            <pre>
              <code
                ref={editableRef}
                contentEditable
                suppressContentEditableWarning
                onInput={onInput}
                onKeyDown={onKeyDown}
                className="code-content"
                data-placeholder={placeholder}
              >
                {text}
              </code>
            </pre>
          </div>
        );

      default:
        return (
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            onInput={onInput}
            onKeyDown={onKeyDown}
            className={cn(
              'block-content',
              isEmpty && isFocused && 'show-placeholder'
            )}
            data-placeholder={placeholder}
          >
            {hasFormatting ? renderDeltaContent(block.content) : text}
          </div>
        );
    }
  };

  // Get block icon
  const getBlockIcon = () => {
    switch (block.type) {
      case 'heading1':
        return <IconH1 className="block-icon heading-icon" />;
      case 'heading2':
        return <IconH2 className="block-icon heading-icon" />;
      case 'heading3':
        return <IconH3 className="block-icon heading-icon" />;
      case 'heading4':
        return <IconH4 className="block-icon heading-icon" />;
      case 'heading5':
        return <IconH5 className="block-icon heading-icon" />;
      case 'heading6':
        return <IconH6 className="block-icon heading-icon" />;
      case 'bulletList':
        return <span className="block-icon list-marker">•</span>;
      case 'numberedList':
        return <span className="block-icon list-marker">1.</span>;
      case 'todoList':
        return block.props.checked ? (
          <IconSquareCheck className="block-icon todo-icon checked" />
        ) : (
          <IconSquare className="block-icon todo-icon" />
        );
      case 'quote':
        return null; // Quote uses border styling
      default:
        return null;
    }
  };

  return (
    <div
      ref={blockRef}
      className={cn(
        'block-wrapper',
        `block-${block.type}`,
        isFocused && 'focused'
      )}
      data-block-id={block.id}
      style={{
        marginLeft: block.props.indent ? `${block.props.indent * 24}px` : undefined,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {getBlockIcon()}
      {renderContent()}
    </div>
  );
}
