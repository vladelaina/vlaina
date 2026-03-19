import { useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
      return;
    }

    e.preventDefault();
    const active = document.activeElement;
    if (active === confirmRef.current) {
      cancelRef.current?.focus();
      return;
    }
    confirmRef.current?.focus();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="z-[120] bg-transparent" />
        <div className="fixed inset-0 z-[121] flex items-center justify-center p-4">
          <DialogPrimitive.Content
            onKeyDown={handleKeyDown}
            className="w-full max-w-[336px] rounded-[32px] border border-zinc-200/80 bg-white shadow-[0_30px_60px_rgba(15,23,42,0.10)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-white/10 dark:bg-[#171717] dark:shadow-[0_30px_60px_rgba(0,0,0,0.34)]"
          >
            <div className="px-6 py-6">
              <DialogTitle className="text-[22px] leading-7 font-semibold tracking-[-0.03em] text-zinc-950 dark:text-zinc-50">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="mt-3 text-[14px] leading-6 text-zinc-500 dark:text-zinc-400">
                  {description}
                </DialogDescription>
              )}

              <div className="mt-6 flex flex-col gap-2">
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={cn(
                    "inline-flex h-11 items-center justify-center rounded-2xl px-4 text-[13px] font-semibold transition-colors outline-none",
                    variant === 'danger'
                      ? "bg-[#ef4444] text-white hover:bg-[#dc2626]"
                      : "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                  )}
                >
                  {confirmText}
                </button>
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-[13px] font-medium text-zinc-700 transition-colors outline-none hover:bg-zinc-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-white/[0.04]"
                >
                  {cancelText}
                </button>
              </div>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
