import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { normalizeTag, normalizeTags } from '@/lib/tags/tagUtils';

const DEFAULT_TAG_SUGGESTIONS = ['Learning', 'Work', 'Personal', 'Urgent'];

interface TagPickerProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestedTags?: string[];
  visible: boolean;
}

export function TagPicker({ value, onChange, suggestedTags = [], visible }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const mergedSuggestions = useMemo(
    () => normalizeTags([...value, ...suggestedTags, ...DEFAULT_TAG_SUGGESTIONS]).slice(0, 12),
    [suggestedTags, value]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (rawTag: string) => {
    const normalized = normalizeTag(rawTag);
    if (!normalized) return;
    onChange(normalizeTags([...value, normalized]));
    setInput('');
  };

  const removeTag = (tag: string) => {
    const next = normalizeTags(value).filter(item => item.toLocaleLowerCase() !== tag.toLocaleLowerCase());
    onChange(next);
  };

  if (!visible && !open) return null;

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'flex items-center justify-center w-5 h-5 rounded-[6px]',
          iconButtonStyles,
          open
            ? 'text-zinc-700 bg-zinc-100 dark:text-zinc-200 dark:bg-zinc-800'
            : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        )}
        title="Set tags"
      >
        <Icon size="md" name="common.tag" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl p-2 z-50"
          >
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(input);
                  }
                }}
                placeholder="Add tag..."
                className="flex-1 px-2 py-1 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500"
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(input)}
                className="px-2 py-1 text-xs rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Add
              </button>
            </div>

            {value.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {value.map(tag => (
                  <button
                    key={`selected-${tag}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => removeTag(tag)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    <span>#{tag}</span>
                    <Icon size="xs" name="common.close" />
                  </button>
                ))}
              </div>
            )}

            {mergedSuggestions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                <div className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1">
                  Suggestions
                </div>
                <div className="flex flex-wrap gap-1">
                  {mergedSuggestions.map(tag => {
                    const selected = value.some(item => item.toLocaleLowerCase() === tag.toLocaleLowerCase());
                    return (
                      <button
                        key={`suggestion-${tag}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => (selected ? removeTag(tag) : addTag(tag))}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-xs border transition-colors',
                          selected
                            ? 'border-zinc-400 bg-zinc-100 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-200'
                            : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600'
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
