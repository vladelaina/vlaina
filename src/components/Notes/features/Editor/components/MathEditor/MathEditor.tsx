// Math Editor component for editing LaTeX formulas
import { useState, useEffect, useRef, useCallback } from 'react';
import { renderLatex } from '../../utils/katex';
import { cn } from '@/lib/utils';

interface MathEditorProps {
  latex: string;
  displayMode: boolean;
  position: { x: number; y: number };
  onChange: (latex: string) => void;
  onClose: () => void;
}

export function MathEditor({
  latex: initialLatex,
  displayMode,
  position,
  onChange,
  onClose
}: MathEditorProps) {
  const [latex, setLatex] = useState(initialLatex);
  const [preview, setPreview] = useState<{ html: string; error: string | null }>({ html: '', error: null });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update preview when latex changes
  useEffect(() => {
    const result = renderLatex(latex, displayMode);
    setPreview(result);
  }, [latex, displayMode]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [latex]);

  const handleSave = useCallback(() => {
    onChange(latex);
    onClose();
  }, [latex, onChange, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-50 bg-[var(--neko-bg-secondary)] rounded-lg shadow-lg border border-[var(--neko-border)]",
        "min-w-[320px] max-w-[480px]"
      )}
      style={{
        left: position.x,
        top: position.y
      }}
    >
      <div className="p-3 border-b border-[var(--neko-border)]">
        <div className="text-xs text-[var(--neko-text-secondary)] mb-2">
          {displayMode ? 'Block Equation' : 'Inline Math'}
        </div>
        <textarea
          ref={textareaRef}
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full min-h-[80px] p-2 rounded-md resize-y",
            "bg-[var(--neko-bg-primary)] text-[var(--neko-text-primary)]",
            "border border-[var(--neko-border)] focus:border-[var(--neko-accent)]",
            "font-mono text-sm outline-none"
          )}
          placeholder="Enter LaTeX..."
          spellCheck={false}
        />
      </div>
      
      <div className="p-3">
        <div className="text-xs text-[var(--neko-text-secondary)] mb-2">Preview</div>
        <div
          className={cn(
            "min-h-[40px] p-2 rounded-md bg-[var(--neko-bg-primary)]",
            "flex items-center",
            displayMode ? "justify-center" : "justify-start",
            preview.error && "border border-red-500/50"
          )}
          dangerouslySetInnerHTML={{ __html: preview.html }}
        />
        {preview.error && (
          <div className="mt-1 text-xs text-red-500 truncate" title={preview.error}>
            {preview.error}
          </div>
        )}
      </div>

      <div className="px-3 pb-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md",
            "text-[var(--neko-text-secondary)] hover:bg-[var(--neko-bg-hover)]",
            "transition-colors"
          )}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md",
            "bg-[var(--neko-accent)] text-white hover:opacity-90",
            "transition-opacity"
          )}
        >
          Save
        </button>
      </div>
    </div>
  );
}
