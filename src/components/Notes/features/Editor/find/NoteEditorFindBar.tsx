import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { NoteEditorFindController } from './types';
import { useI18n } from '@/lib/i18n';

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
          ? 'text-[var(--vlaina-color-status-info-fg)] bg-[var(--vlaina-color-status-info-bg)]'
          : 'text-[var(--vlaina-color-text-soft)] hover:bg-[var(--vlaina-hover)] hover:text-[var(--vlaina-color-text-strong)]',
        disabled && 'cursor-not-allowed opacity-20 hover:bg-transparent',
        className
      )}
    >
      <Icon name={icon as never} size="sm" />
    </button>
  );
}

export function NoteEditorFindBar({ controller }: NoteEditorFindBarProps) {
  const { t } = useI18n();
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
        boxShadow: hasQuery ? 'var(--vlaina-shadow-floating-panel)' : 'var(--vlaina-shadow-panel-soft)',
      }}
      transition={{
        default: { type: 'spring', stiffness: 500, damping: 35 },
      }}
      className="w-[min(400px,calc(100vw-2rem))] max-w-full rounded-[22px] bg-[var(--vlaina-color-setting-field)] border border-[var(--vlaina-color-panel-border)] backdrop-blur-3xl shadow-2xl p-1.5"
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
          placeholder={t('notes.find')}
          spellCheck={false}
          className="h-8 min-w-0 flex-1 bg-transparent py-0 text-[15px] font-medium leading-5 text-[var(--vlaina-color-text-strong)] outline-none placeholder:text-[var(--vlaina-color-text-soft)] tracking-tight"
        />

        <div className="flex items-center gap-1.5">
          <div className="flex min-w-[132px] items-center justify-end gap-1">
            <span
              className={cn(
                'shrink-0 px-1 text-[11px] font-bold tabular-nums uppercase tracking-tighter transition-opacity',
                hasQuery ? 'text-[var(--vlaina-color-text-soft)] opacity-100' : 'text-[var(--vlaina-color-text-disabled)] opacity-0',
              )}
            >
              {matchLabel}
            </span>
            <div className="flex items-center gap-0.5 border-l border-[var(--vlaina-border)] pl-1">
              <FindToolbarButton
                label={t('notes.previous')}
                icon="nav.chevronUp"
                onClick={controller.goToPrevious}
                disabled={!controller.canNavigate}
              />
              <FindToolbarButton
                label={t('notes.next')}
                icon="nav.chevronDown"
                onClick={controller.goToNext}
                disabled={!controller.canNavigate}
              />
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <FindToolbarButton
              label={controller.isReplaceOpen ? t('notes.hideReplace') : t('notes.showReplace')}
              icon="common.refresh"
              onClick={controller.toggleReplace}
              active={controller.isReplaceOpen}
            />
            <FindToolbarButton
              label={t('common.close')}
              icon="common.close"
              onClick={() => controller.close()}
              className="hover:text-[var(--vlaina-color-status-danger-fg)] hover:bg-[var(--vlaina-color-status-danger-bg)]"
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
            <div className="flex items-center gap-3 px-2 py-3 border-t border-[var(--vlaina-border)] mt-1">
              <input
                ref={controller.replaceInputRef}
                value={controller.replaceValue}
                onChange={(event) => controller.setReplaceValue(event.target.value)}
                onKeyDown={controller.handleReplaceKeyDown}
                placeholder={t('notes.replaceWith')}
                spellCheck={false}
                className="h-8 min-w-0 flex-1 bg-transparent px-3 py-0 text-[14px] font-medium leading-5 text-[var(--vlaina-text-primary)] outline-none placeholder:text-[var(--vlaina-color-text-soft)] tracking-tight"
              />

              <div className="flex items-center gap-1.5 pr-1">
                <button
                  type="button"
                  disabled={!controller.canReplace}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => controller.replaceAll()}
                  className={cn(
                    'px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--vlaina-color-text-soft)] transition-all rounded-xl hover:bg-[var(--vlaina-hover)] hover:text-[var(--vlaina-color-text-strong)]',
                    !controller.canReplace && 'opacity-20 cursor-not-allowed',
                  )}
                >
                  {t('notes.replaceAll')}
                </button>
                <button
                  type="button"
                  disabled={!controller.canReplace}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => controller.replaceCurrent()}
                  className={cn(
                    'px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest bg-[var(--vlaina-accent)] text-[var(--vlaina-color-white)] rounded-xl transition-all active:scale-95 shadow-none',
                    !controller.canReplace && 'opacity-50 grayscale cursor-not-allowed',
                  )}
                >
                  {t('notes.replace')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
