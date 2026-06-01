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
            overlayClassName="bg-[var(--vlaina-color-drop-overlay)]"
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
            className="w-full max-w-[360px] rounded-[34px] border border-transparent bg-[var(--vlaina-color-setting-field)] shadow-[var(--vlaina-shadow-raised-soft)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <div className="px-7 py-7">
              <DialogTitle className="text-[24px] leading-8 font-semibold tracking-[-0.03em] text-[var(--vlaina-color-text-strong)]">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription id={descriptionId} className="mt-3 text-[14px] leading-6 text-[var(--notes-sidebar-text-soft)]">
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
                      "inline-flex h-12 items-center justify-center rounded-full border border-transparent px-5 text-[14px] font-semibold shadow-[var(--vlaina-shadow-raised-soft)] transition-[color,background-color,box-shadow,border-color,transform] outline-none ring-offset-2 ring-offset-[var(--vlaina-color-setting-field)] active:scale-[0.985]",
                      showKeyboardSelection && 'focus:ring-2',
                      auxActionVariant === 'success'
                        ? "bg-[var(--vlaina-color-status-success-fg)] text-[var(--vlaina-color-white)] hover:bg-[var(--vlaina-color-success)] focus:ring-[var(--vlaina-color-status-success-fg)]/35"
                        : "bg-[var(--vlaina-color-inverse-surface)] text-[var(--vlaina-color-inverse-text)] hover:bg-[var(--vlaina-color-inverse-surface-hover)] focus:ring-[var(--vlaina-color-inverse-surface)]/20"
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
                    "inline-flex h-12 items-center justify-center rounded-full border border-transparent px-5 text-[14px] font-semibold transition-[color,background-color,box-shadow,border-color,transform] outline-none ring-offset-2 ring-offset-[var(--vlaina-color-setting-field)] active:scale-[0.985]",
                    showKeyboardSelection && 'focus:ring-2',
                    variant === 'danger'
                      ? "bg-[var(--vlaina-color-danger)] text-[var(--vlaina-color-white)] shadow-none hover:bg-[var(--vlaina-color-danger-hover)] focus:ring-[var(--vlaina-color-danger)]/35"
                      : "bg-[var(--vlaina-color-inverse-surface)] text-[var(--vlaina-color-inverse-text)] shadow-[var(--vlaina-shadow-raised-soft)] hover:bg-[var(--vlaina-color-inverse-surface-hover)] focus:ring-[var(--vlaina-color-inverse-surface)]/20"
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
                    "inline-flex h-12 items-center justify-center rounded-full border border-transparent bg-[var(--vlaina-color-setting-field)] px-5 text-[14px] font-medium text-[var(--notes-sidebar-text)] shadow-[var(--vlaina-shadow-raised-soft)] transition-[color,background-color,box-shadow,border-color,transform] outline-none ring-offset-2 ring-offset-[var(--vlaina-color-setting-field)] hover:bg-[var(--vlaina-hover-filled)] active:scale-[0.985]",
                    showKeyboardSelection && 'focus:ring-2 focus:ring-[var(--vlaina-color-inverse-surface)]/20',
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
