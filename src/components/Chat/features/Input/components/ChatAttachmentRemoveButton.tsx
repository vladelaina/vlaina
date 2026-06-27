import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { chatComposerAttachmentRemoveButtonBaseClass } from '../composerStyles';

type ChatAttachmentRemoveButtonPlacement = 'file-token' | 'image-thumbnail' | 'mention-token';

const placementClassByType: Record<ChatAttachmentRemoveButtonPlacement, string> = {
  'file-token': 'right-1.5 top-1/2 -translate-y-1/2',
  'image-thumbnail': 'right-1 top-1',
  'mention-token': '-right-1 -top-1',
};

interface ChatAttachmentRemoveButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  placement: ChatAttachmentRemoveButtonPlacement;
}

export function ChatAttachmentRemoveButton({
  placement,
  className,
  children,
  type = 'button',
  ...props
}: ChatAttachmentRemoveButtonProps) {
  return (
    <button
      {...props}
      type={type}
      data-chat-attachment-remove-button="true"
      className={cn(
        chatComposerAttachmentRemoveButtonBaseClass,
        placementClassByType[placement],
        className
      )}
    >
      {children ?? <Icon name="common.close" size="xs" />}
    </button>
  );
}
