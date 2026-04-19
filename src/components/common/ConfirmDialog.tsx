import { useId, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogDescription,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { BlurBackdrop } from '@/components/common/BlurBackdrop';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  onCancelAction?: () => void | Promise<void>;
  onAuxAction?: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmText?: string;
  auxActionText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
  auxActionVariant?: 'success' | 'default';
  initialFocus?: 'confirm' | 'cancel';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  onCancelAction,
  onAuxAction,
  title,
  description,
  confirmText = 'Confirm',
  auxActionText,
  cancelText = 'Cancel',
  variant = 'default',
  auxActionVariant = 'default',
  initialFocus = 'confirm',
}: ConfirmDialogProps) {
  const descriptionId = useId();
  const auxActionRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [showKeyboardSelection, setShowKeyboardSelection] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isBackward = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    const isForward = e.key === 'ArrowRight' || e.key === 'ArrowDown';

    if (!isBackward && !isForward) {
      return;
    }

    setShowKeyboardSelection(true);

    const focusableButtons = [
      auxActionRef.current,
      confirmRef.current,
      cancelRef.current,
    ].filter((button): button is HTMLButtonElement => button !== null);

    if (focusableButtons.length < 2) {
      return;
    }

    e.preventDefault();
    const activeIndex = focusableButtons.findIndex((button) => button === document.activeElement);
    const currentIndex = activeIndex === -1 ? 0 : activeIndex;
    const delta = isBackward ? -1 : 1;
    const nextIndex = (currentIndex + delta + focusableButtons.length) % focusableButtons.length;
    focusableButtons[nextIndex]?.focus();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogPrimitive.Overlay asChild>
          <BlurBackdrop
            className="z-[120]"
            overlayClassName="bg-white/20 dark:bg-white/5"
            zIndex={120}
            blurPx={6}
            duration={0.2}
          />
        </DialogPrimitive.Overlay>
        <div className="fixed inset-0 z-[121] flex items-center justify-center p-4">
          <DialogPrimitive.Content
            aria-describedby={description ? descriptionId : undefined}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              setShowKeyboardSelection(false);
              if (initialFocus === 'cancel') {
                cancelRef.current?.focus();
                return;
              }
              confirmRef.current?.focus();
            }}
            onKeyDown={handleKeyDown}
            className="w-full max-w-[360px] rounded-[34px] border border-zinc-200/80 bg-white shadow-[0_30px_60px_rgba(15,23,42,0.10)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-white/10 dark:bg-[#171717] dark:shadow-[0_30px_60px_rgba(0,0,0,0.34)]"
          >
            <div className="px-7 py-7">
              <DialogTitle className="text-[24px] leading-8 font-semibold tracking-[-0.03em] text-zinc-950 dark:text-zinc-50">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription id={descriptionId} className="mt-3 text-[14px] leading-6 text-zinc-500 dark:text-zinc-400">
                  {description}
                </DialogDescription>
              )}

              <div className="mt-7 flex flex-col gap-2.5">
                {onAuxAction && auxActionText ? (
                  <button
                    ref={auxActionRef}
                    type="button"
                    onClick={async () => {
                      await onAuxAction();
                    }}
                    className={cn(
                      "inline-flex h-12 items-center justify-center rounded-2xl px-4 text-[14px] font-semibold transition-[color,background-color,box-shadow,border-color] outline-none ring-offset-2 ring-offset-white dark:ring-offset-[#171717]",
                      showKeyboardSelection && 'focus:ring-2',
                      auxActionVariant === 'success'
                        ? "bg-[#16a34a] text-white hover:bg-[#15803d] focus:ring-[#16a34a]/35 dark:focus:ring-[#22c55e]/35"
                        : "bg-zinc-950 text-white hover:bg-zinc-800 focus:ring-zinc-950/20 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus:ring-zinc-100/30"
                    )}
                  >
                    {auxActionText}
                  </button>
                ) : null}
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={async () => {
                    await onConfirm();
                    onClose();
                  }}
                  className={cn(
                    "inline-flex h-12 items-center justify-center rounded-2xl px-4 text-[14px] font-semibold transition-[color,background-color,box-shadow,border-color] outline-none ring-offset-2 ring-offset-white dark:ring-offset-[#171717]",
                    showKeyboardSelection && 'focus:ring-2',
                    variant === 'danger'
                      ? "bg-[#ef4444] text-white hover:bg-[#dc2626] focus:ring-[#ef4444]/35 dark:focus:ring-[#f87171]/35"
                      : "bg-zinc-950 text-white hover:bg-zinc-800 focus:ring-zinc-950/20 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus:ring-zinc-100/30"
                  )}
                >
                  {confirmText}
                </button>
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={async () => {
                    if (onCancelAction) {
                      await onCancelAction();
                      return;
                    }
                    onClose();
                  }}
                  className={cn(
                    "inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-[14px] font-medium text-zinc-700 transition-[color,background-color,box-shadow,border-color] outline-none ring-offset-2 ring-offset-white hover:bg-zinc-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-300 dark:ring-offset-[#171717] dark:hover:bg-white/[0.04]",
                    showKeyboardSelection && 'focus:border-zinc-400 focus:ring-2 focus:ring-zinc-950/12 dark:focus:border-white/30 dark:focus:ring-zinc-100/20',
                  )}
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
