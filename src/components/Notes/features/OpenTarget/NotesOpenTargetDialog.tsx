import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface NotesOpenTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFolder: () => void | Promise<void>;
  onOpenFile: () => void | Promise<void>;
  isBusy?: boolean;
}

export function NotesOpenTargetDialog({
  open,
  onOpenChange,
  onOpenFolder,
  onOpenFile,
  isBusy = false,
}: NotesOpenTargetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        useBlurBackdrop
        blurBackdropProps={{ overlayClassName: 'bg-white/20 dark:bg-white/5', blurPx: 6, duration: 0.2 }}
        className="sm:max-w-md rounded-[20px] border border-black/5 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] dark:border-white/5 dark:bg-[#1E1E1E] dark:shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="gap-1 px-1">
          <DialogTitle className="text-zinc-900 dark:text-zinc-100">Open in Notes</DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">
            Choose whether to open a folder as a vault or open a Markdown file.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto items-start justify-start gap-3 rounded-2xl px-4 py-4 text-left"
            disabled={isBusy}
            onClick={() => void onOpenFolder()}
          >
            <Icon name="file.folderOpen" size="md" className="mt-0.5 text-zinc-500" />
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">Open Folder</div>
              <div className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                Open a folder as the current Notes vault.
              </div>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto items-start justify-start gap-3 rounded-2xl px-4 py-4 text-left"
            disabled={isBusy}
            onClick={() => void onOpenFile()}
          >
            <Icon name="file.text" size="md" className="mt-0.5 text-zinc-500" />
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">Open Markdown File</div>
              <div className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                Open a Markdown file and switch to its containing vault.
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
