import { useEffect } from 'react';

interface UseModalBehaviorOptions {
  open: boolean;
  onClose: () => void;
  isEditing?: boolean;
  onCancelEdit?: () => void;
}

export function useModalBehavior({
  open,
  onClose,
  isEditing = false,
  onCancelEdit,
}: UseModalBehaviorOptions) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing && onCancelEdit) {
          onCancelEdit();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, isEditing, onCancelEdit]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);
}