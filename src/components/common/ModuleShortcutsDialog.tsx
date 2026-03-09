import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { cn } from '@/lib/utils';
import { ModuleShortcutId, ModuleShortcutSection, getModuleShortcutPreset } from '@/lib/shortcuts/moduleShortcuts';

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-[#1E1E1E] border-gray-200 dark:border-zinc-800 shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            {resolvedTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">{resolvedDescription}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-4 pb-6 space-y-4">
          {resolvedSections.map((section) => (
            <section key={section.title} className="space-y-1.5">
              <h3 className="px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.shortcuts.map((shortcut, index) => (
                  <div
                    key={`${section.title}-${shortcut.action}-${index}`}
                    className={cn(
                      'flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors',
                      'hover:bg-gray-50 dark:hover:bg-white/5',
                    )}
                  >
                    <span className="text-[14px] text-gray-600 dark:text-gray-400 font-medium">
                      {shortcut.action}
                    </span>
                    <ShortcutKeys keys={shortcut.keys} />
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
