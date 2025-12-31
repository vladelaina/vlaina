/**
 * Inline Toolbar - Text formatting toolbar that appears on text selection
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useEditorContext } from '../EditorContext';
import { useEditorStore } from '../EditorStore';
import type { InlineFormat } from '../types';
import { cn } from '@/lib/utils';
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrikethrough,
  IconCode,
  IconLink,
  IconX,
} from '@tabler/icons-react';

interface ToolbarButton {
  id: InlineFormat;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { id: 'bold', icon: <IconBold size={16} />, label: 'Bold', shortcut: 'Ctrl+B' },
  { id: 'italic', icon: <IconItalic size={16} />, label: 'Italic', shortcut: 'Ctrl+I' },
  { id: 'underline', icon: <IconUnderline size={16} />, label: 'Underline', shortcut: 'Ctrl+U' },
  { id: 'strikethrough', icon: <IconStrikethrough size={16} />, label: 'Strikethrough', shortcut: 'Ctrl+Shift+S' },
  { id: 'code', icon: <IconCode size={16} />, label: 'Code', shortcut: 'Ctrl+E' },
  { id: 'link', icon: <IconLink size={16} />, label: 'Link', shortcut: 'Ctrl+K' },
];

export function InlineToolbar() {
  const { inlineToolbar, setInlineToolbar } = useEditorContext();
  const { applyInlineFormat } = useEditorStore();
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Handle format button click
  const handleFormat = useCallback((format: InlineFormat) => {
    if (format === 'link') {
      setShowLinkInput(true);
      setTimeout(() => linkInputRef.current?.focus(), 0);
      return;
    }

    const isActive = inlineToolbar.activeFormats.has(format);
    applyInlineFormat(format, !isActive);
    
    // Update active formats
    setInlineToolbar(prev => {
      const newFormats = new Set(prev.activeFormats);
      if (isActive) {
        newFormats.delete(format);
      } else {
        newFormats.add(format);
      }
      return { ...prev, activeFormats: newFormats };
    });
  }, [inlineToolbar.activeFormats, applyInlineFormat, setInlineToolbar]);

  // Handle link submit
  const handleLinkSubmit = useCallback(() => {
    if (linkUrl.trim()) {
      applyInlineFormat('link', linkUrl.trim());
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [linkUrl, applyInlineFormat]);

  // Handle link input key down
  const handleLinkKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLinkSubmit();
    } else if (e.key === 'Escape') {
      setShowLinkInput(false);
      setLinkUrl('');
    }
  }, [handleLinkSubmit]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!inlineToolbar.isVisible) return;

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      let format: InlineFormat | null = null;

      if (e.key === 'b' || e.key === 'B') {
        format = 'bold';
      } else if (e.key === 'i' || e.key === 'I') {
        format = 'italic';
      } else if (e.key === 'u' || e.key === 'U') {
        format = 'underline';
      } else if (e.key === 'e' || e.key === 'E') {
        format = 'code';
      } else if (e.key === 'k' || e.key === 'K') {
        format = 'link';
      } else if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
        format = 'strikethrough';
      }

      if (format) {
        e.preventDefault();
        handleFormat(format);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inlineToolbar.isVisible, handleFormat]);

  // Close toolbar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!toolbarRef.current?.contains(e.target as Node)) {
        setInlineToolbar(prev => ({ ...prev, isVisible: false }));
        setShowLinkInput(false);
        setLinkUrl('');
      }
    };

    if (inlineToolbar.isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [inlineToolbar.isVisible, setInlineToolbar]);

  if (!inlineToolbar.isVisible) return null;

  return (
    <div
      ref={toolbarRef}
      className="inline-toolbar"
      style={{
        left: inlineToolbar.position.x,
        top: inlineToolbar.position.y,
      }}
    >
      {showLinkInput ? (
        <div className="inline-toolbar-link-input">
          <input
            ref={linkInputRef}
            type="url"
            placeholder="Enter URL..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            className="link-input"
          />
          <button
            className="link-submit"
            onClick={handleLinkSubmit}
            disabled={!linkUrl.trim()}
          >
            <IconLink size={14} />
          </button>
          <button
            className="link-cancel"
            onClick={() => {
              setShowLinkInput(false);
              setLinkUrl('');
            }}
          >
            <IconX size={14} />
          </button>
        </div>
      ) : (
        <>
          {TOOLBAR_BUTTONS.map((button) => (
            <button
              key={button.id}
              className={cn(
                'inline-toolbar-btn',
                inlineToolbar.activeFormats.has(button.id) && 'active'
              )}
              onClick={() => handleFormat(button.id)}
              title={`${button.label} (${button.shortcut})`}
            >
              {button.icon}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
