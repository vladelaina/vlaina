import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { NoteEditorFindController } from './types';

interface NoteEditorFindBarProps {
  controller: NoteEditorFindController;
}

function FindToolbarButton({
  label,
  icon,
  onClick,
  disabled = false,
  active = false,
  className,
}: {
  label: string;
  icon: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all active:scale-90',
        active
          ? 'text-blue-500 bg-blue-500/10'
          : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100',
        disabled && 'cursor-not-allowed opacity-20 hover:bg-transparent',
        className
      )}
    >
      <Icon name={icon as never} size="sm" />
    </button>
  );
}

export function NoteEditorFindBar({ controller }: NoteEditorFindBarProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!controller.isOpen) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (containerRef.current?.contains(target)) {
        return;
      }

      controller.close(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [controller.close, controller.isOpen]);

  if (!controller.isOpen) {
    return null;
  }

  const hasQuery = controller.query.length > 0;
  const matchLabel = hasQuery
    ? `${controller.activeMatchNumber} / ${controller.totalMatches}`
    : '0 / 0';

  return (
    <motion.div
      ref={containerRef}
      initial={{ scale: 0.98, opacity: 0, y: -10 }}
      animate={{
        scale: 1,
        opacity: 1,
        y: 0,
        boxShadow: hasQuery ? '0 20px 50px rgba(0,0,0,0.1)' : '0 10px 30px rgba(0,0,0,0.08)',
      }}
      transition={{
        default: { type: 'spring', stiffness: 500, damping: 35 },
      }}
      className="w-[min(400px,calc(100vw-2rem))] max-w-full rounded-[22px] bg-white/95 dark:bg-zinc-900/95 border border-black/[0.05] dark:border-white/[0.05] backdrop-blur-3xl shadow-2xl p-1.5"
    >
      <div
        className={cn(
          'flex h-11 items-center gap-3 pl-4 pr-1',
          controller.isReplaceOpen && 'mb-1',
        )}
      >
        <input
          ref={controller.inputRef}
          value={controller.query}
          onChange={(event) => controller.setQuery(event.target.value)}
          onKeyDown={controller.handleQueryKeyDown}
          placeholder="Find"
          spellCheck={false}
          autoFocus
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-zinc-900 dark:text-zinc-100 outline-none placeholder:text-zinc-400/60 tracking-tight"
        />

        <div className="flex items-center gap-1.5">
          <div className="flex min-w-[132px] items-center justify-end gap-1">
            <span
              className={cn(
                'shrink-0 px-1 text-[11px] font-bold tabular-nums uppercase tracking-tighter transition-opacity',
                hasQuery ? 'text-zinc-400/80 opacity-100' : 'text-zinc-300/70 opacity-0',
              )}
            >
              {matchLabel}
            </span>
            <div className="flex items-center gap-0.5 border-l border-black/[0.05] pl-1 dark:border-white/[0.05]">
              <FindToolbarButton
                label="Previous"
                icon="nav.chevronUp"
                onClick={controller.goToPrevious}
                disabled={!controller.canNavigate}
              />
              <FindToolbarButton
                label="Next"
                icon="nav.chevronDown"
                onClick={controller.goToNext}
                disabled={!controller.canNavigate}
              />
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <FindToolbarButton
              label={controller.isReplaceOpen ? 'Hide replace' : 'Show replace'}
              icon="common.refresh"
              onClick={controller.toggleReplace}
              active={controller.isReplaceOpen}
            />
            <FindToolbarButton
              label="Close"
              icon="common.close"
              onClick={() => controller.close()}
              className="hover:text-red-500 hover:bg-red-500/5"
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {controller.isReplaceOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-2 py-3 border-t border-black/[0.03] dark:border-white/[0.03] mt-1">
              <input
                ref={controller.replaceInputRef}
                value={controller.replaceValue}
                onChange={(event) => controller.setReplaceValue(event.target.value)}
                onKeyDown={controller.handleReplaceKeyDown}
                placeholder="Replace with"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent px-3 text-[14px] text-zinc-700 dark:text-zinc-300 outline-none placeholder:text-zinc-400/60 font-medium tracking-tight"
              />

              <div className="flex items-center gap-1.5 pr-1">
                <button
                  type="button"
                  disabled={!controller.canReplace}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => controller.replaceAll()}
                  className={cn(
                    'px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-400 transition-all rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100',
                    !controller.canReplace && 'opacity-20 cursor-not-allowed',
                  )}
                >
                  All
                </button>
                <button
                  type="button"
                  disabled={!controller.canReplace}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => controller.replaceCurrent()}
                  className={cn(
                    'px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest bg-blue-500 text-white rounded-xl transition-all active:scale-95 shadow-none',
                    !controller.canReplace && 'opacity-50 grayscale cursor-not-allowed',
                  )}
                >
                  Replace
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
