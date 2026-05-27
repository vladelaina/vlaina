import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { cn } from '@/lib/utils';
import { ModuleShortcutId, ModuleShortcutSection, getModuleShortcutPreset } from '@/lib/shortcuts/moduleShortcuts';
import { useDialogWindowDrag } from '@/hooks/useDialogWindowDrag';
import { useI18n } from '@/lib/i18n';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

interface ModuleShortcutsDialogProps {
  module: ModuleShortcutId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  sections?: ModuleShortcutSection[];
}

const SHORTCUT_KEY_ALIASES: Record<string, string[]> = {
  Ctrl: ['ctrl', 'control', 'ctl', '^', '⌃', 'cmd', 'command', 'meta', '⌘'],
  Control: ['ctrl', 'control', 'ctl', '^', '⌃'],
  Meta: ['meta', 'cmd', 'command', '⌘'],
  Shift: ['shift', '⇧'],
  Alt: ['alt', 'option', 'opt', '⌥'],
  Option: ['option', 'opt', 'alt', '⌥'],
  '/': ['/', 'slash', '斜杠', 'スラッシュ', '슬래시'],
  '\\': ['\\', 'backslash', '反斜杠', 'バックスラッシュ', '백슬래시'],
  ',': [',', 'comma', '逗号', 'カンマ', '쉼표'],
  '.': ['.', 'period', 'dot', 'fullstop', '句号', 'ドット', '마침표'],
  '`': ['`', 'backtick', 'grave', '反引号'],
  '-': ['-', 'minus', 'dash', 'hyphen', '减号'],
  '=': ['=', 'equals', 'equal', '等号'],
  '[': ['[', 'left bracket', 'open bracket', '左括号'],
  ']': [']', 'right bracket', 'close bracket', '右括号'],
  Backspace: ['backspace', 'delete', 'del', '⌫', '退格'],
  Enter: ['enter', 'return', '回车'],
  Tab: ['tab', '制表'],
  Escape: ['escape', 'esc'],
};

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '');
}

function compactSearchValue(value: string) {
  return normalizeSearchValue(value)
    .replace(/\\/g, ' backslash ')
    .replace(/\//g, ' slash ')
    .replace(/,/g, ' comma ')
    .replace(/\./g, ' period ')
    .replace(/`/g, ' backtick ')
    .replace(/-/g, ' minus ')
    .replace(/\[/g, ' leftbracket ')
    .replace(/\]/g, ' rightbracket ')
    .replace(/[+_(){}]+/g, ' ')
    .replace(/\s+/g, '');
}

function getShortcutSearchCandidates(keys: string[]) {
  const keyAliases = keys.map((key) => SHORTCUT_KEY_ALIASES[key] ?? [key]);
  const orderedPhrases = keyAliases.reduce<string[]>((phrases, aliases) => {
    if (phrases.length === 0) {
      return aliases;
    }

    return phrases.flatMap((phrase) => aliases.map((alias) => `${phrase} ${alias}`));
  }, []);

  return [
    keys.join(' '),
    keys.join('+'),
    ...keys,
    ...keyAliases.flat(),
    ...orderedPhrases,
    ...orderedPhrases.map((phrase) => phrase.replace(/\s+/g, '+')),
    ...orderedPhrases.map((phrase) => phrase.replace(/\s+/g, '-')),
  ];
}

export function ModuleShortcutsDialog({
  module,
  open,
  onOpenChange,
  title,
  sections,
}: ModuleShortcutsDialogProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const preset = getModuleShortcutPreset(module, { isMac, t });
  const resolvedTitle = title ?? preset.title;
  const resolvedDescription = preset.description;
  const resolvedSections = sections ?? preset.sections;
  const shortcutKeyClassName = 'rounded-md bg-[var(--chat-sidebar-row-hover)] text-[var(--chat-sidebar-text)] shadow-none';
  const normalizedSearchQuery = normalizeSearchValue(searchQuery);
  const compactSearchQuery = compactSearchValue(searchQuery);
  const filteredSections = useMemo(() => {
    if (!normalizedSearchQuery) {
      return resolvedSections;
    }
    if (normalizedSearchQuery === '+') {
      return [];
    }

    return resolvedSections
      .map((section) => ({
        ...section,
        shortcuts: section.shortcuts.filter((shortcut) => {
          const searchCandidates = [
            section.title,
            shortcut.action,
            ...getShortcutSearchCandidates(shortcut.keys),
          ];

          return searchCandidates.some((candidate) => {
            const normalizedCandidate = normalizeSearchValue(candidate);
            return normalizedCandidate.includes(normalizedSearchQuery)
              || (compactSearchQuery.length > 0 && compactSearchValue(candidate).includes(compactSearchQuery));
          });
        }),
      }))
      .filter((section) => section.shortcuts.length > 0);
  }, [compactSearchQuery, normalizedSearchQuery, resolvedSections]);
  const {
    handleDragHandleMouseDown,
    handleInteractOutside,
    handlePointerDownOutside,
  } = useDialogWindowDrag({
    open,
    onOpenChange,
    errorLabel: 'shortcuts dialog drag',
  });

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      return;
    }

    const scheduleFrame: (callback: FrameRequestCallback) => number = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    const cancelFrame: (id: number) => void = typeof window.cancelAnimationFrame === 'function'
      ? window.cancelAnimationFrame.bind(window)
      : (id: number) => window.clearTimeout(id);
    const frameId = scheduleFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelFrame(frameId);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        useBlurBackdrop
        blurBackdropProps={{ overlayClassName: 'bg-white/20 dark:bg-white/5', blurPx: 6, duration: 0.05 }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        onPointerDownOutside={handlePointerDownOutside}
        onInteractOutside={handleInteractOutside}
        className="sm:max-w-lg rounded-[20px] border border-black/5 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] overflow-hidden duration-75 dark:border-white/5 dark:bg-[#1E1E1E] dark:shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
      >
        <div
          className="vlaina-drag-region flex min-w-0 items-center justify-between gap-3 px-1 pb-4 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragHandleMouseDown}
        >
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <DialogTitle className="min-w-0 truncate text-[20px] font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-100">
                {resolvedTitle}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {resolvedDescription}
              </DialogDescription>
              <ShortcutKeys
                keys={['Ctrl', '/']}
                className="shrink-0"
                keyClassName={shortcutKeyClassName}
              />
              <div
                className="vlaina-no-drag relative ml-1 flex h-[34px] min-w-[96px] max-w-[240px] flex-1 items-center gap-2 rounded-full px-3 cursor-auto select-text"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className={cn('absolute inset-0 rounded-full', chatComposerPillSurfaceClass)} />
                <Icon
                  name="common.search"
                  size={16}
                  className="relative z-[1] shrink-0 text-[var(--vlaina-color-text-soft)]"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  role="searchbox"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('sidebar.search')}
                  aria-label={`${t('sidebar.search')} ${resolvedTitle}`}
                  spellCheck={false}
                  className="relative z-[1] min-w-0 flex-1 bg-transparent text-[13px] text-[var(--chat-sidebar-text)] outline-none placeholder:text-[var(--vlaina-color-text-soft)]"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    aria-label={t('common.close')}
                    className="relative z-[1] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--vlaina-color-text-soft)] transition-colors hover:bg-[var(--chat-sidebar-row-hover)] hover:text-[var(--chat-sidebar-text)]"
                  >
                    <Icon name="common.close" size="sm" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <DialogClose
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            className="vlaina-no-drag inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <Icon name="common.close" size="md" />
            <span className="sr-only">{t('common.close')}</span>
          </DialogClose>
        </div>

        <div className="max-h-[65vh] overflow-y-auto space-y-3 pr-1">
          {filteredSections.length > 0 ? filteredSections.map((section) => (
            <section key={section.title} className="rounded-[16px]">
              <h3 className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {section.title}
              </h3>

              <div className="space-y-1">
                {section.shortcuts.map((shortcut, index) => (
                  <div
                    key={`${section.title}-${shortcut.action}-${index}`}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors',
                      'hover:bg-zinc-50 dark:hover:bg-white/5'
                    )}
                  >
                    <span className="min-w-0 flex-1 text-[14px] font-medium text-zinc-600 dark:text-zinc-300">
                      {shortcut.action}
                    </span>
                    <ShortcutKeys
                      keys={shortcut.keys}
                      className="shrink-0"
                      keyClassName={shortcutKeyClassName}
                    />
                  </div>
                ))}
              </div>
            </section>
          )) : (
            <div className="px-3 py-8 text-center text-[13px] font-medium text-zinc-400 dark:text-zinc-500">
              {t('notes.noResults')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
