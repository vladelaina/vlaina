/**
 * EditorStatusBar - Status bar showing word count and other stats
 * 
 * Modern block-editor style status bar
 */

import { useMemo } from 'react';

interface EditorStatusBarProps {
  content: string;
}

export function EditorStatusBar({ content }: EditorStatusBarProps) {
  const stats = useMemo(() => {
    const text = content.trim();
    
    // Word count (split by whitespace)
    const words = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
    
    // Character count (excluding whitespace)
    const chars = text.replace(/\s/g, '').length;
    
    // Line count
    const lines = text ? text.split('\n').length : 0;
    
    return { words, chars, lines };
  }, [content]);

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 border-t border-[var(--neko-border)] bg-[var(--neko-bg-secondary)] text-[11px] text-[var(--neko-text-tertiary)]">
      <span>{stats.words} words</span>
      <span>{stats.chars} characters</span>
      <span>{stats.lines} lines</span>
    </div>
  );
}
