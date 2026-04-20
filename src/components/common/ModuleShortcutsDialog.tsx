import { Icon } from '@/components/ui/icons';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { cn } from '@/lib/utils';
import { ModuleShortcutId, ModuleShortcutSection, getModuleShortcutPreset } from '@/lib/shortcuts/moduleShortcuts';
import { useDialogWindowDrag } from '@/hooks/useDialogWindowDrag';

interface ModuleShortcutsDialogProps {
  module: ModuleShortcutId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  sections?: ModuleShortcutSection[];
}

export function ModuleShortcutsDialog({
  module,
  open,
  onOpenChange,
  title,
  description,
  sections,
}: ModuleShortcutsDialogProps) {
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const preset = getModuleShortcutPreset(module, { isMac });
  const resolvedTitle = title ?? preset.title;
  const resolvedDescription = description ?? preset.description;
  const resolvedSections = sections ?? preset.sections;
  const {
    handleDragHandleMouseDown,
    handleInteractOutside,
    handlePointerDownOutside,
  } = useDialogWindowDrag({
    open,
    onOpenChange,
    errorLabel: 'shortcuts dialog drag',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        useBlurBackdrop
        blurBackdropProps={{ overlayClassName: 'bg-white/20 dark:bg-white/5', blurPx: 6, duration: 0.2 }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        onPointerDownOutside={handlePointerDownOutside}
        onInteractOutside={handleInteractOutside}
        className="sm:max-w-lg rounded-[20px] border border-black/5 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] overflow-hidden dark:border-white/5 dark:bg-[#1E1E1E] dark:shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
      >
        <div
          className="vlaina-drag-region flex min-w-0 items-start justify-between gap-3 px-1 pb-4 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragHandleMouseDown}
        >
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <DialogTitle className="text-[20px] font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-100">
                {resolvedTitle}
              </DialogTitle>
              <ShortcutKeys
                keys={['Ctrl', '/']}
                className="shrink-0"
                keyClassName="rounded-[8px] border border-zinc-200 bg-zinc-50 text-[10px] font-medium text-zinc-700 shadow-none dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
              />
            </div>
            <DialogDescription className="mt-1 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
              {resolvedDescription}
            </DialogDescription>
          </div>

          <DialogClose
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            className="vlaina-no-drag inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <Icon name="common.close" size="md" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="max-h-[65vh] overflow-y-auto space-y-3 pr-1">
          {resolvedSections.map((section) => (
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
                      keyClassName="rounded-[8px] border border-zinc-200 bg-zinc-50 text-[10px] font-medium text-zinc-700 shadow-none dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
