import { useEffect, useLayoutEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { themeTextAreaTokens } from '@/styles/themeTokens';

interface SidebarInlineRenameInputProps
  extends Omit<
    ComponentPropsWithoutRef<'textarea'>,
    'onBlur' | 'onChange' | 'onKeyDown' | 'onMouseDown' | 'value'
  > {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
  selectOnMount?: boolean;
}

export function SidebarInlineRenameInput({
  value,
  onValueChange,
  onSubmit,
  onCancel,
  selectOnMount = true,
  onClick,
  className,
  ...props
}: SidebarInlineRenameInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.style.height = themeTextAreaTokens.heightAuto;
    input.style.height = `${Math.min(input.scrollHeight, themeTextAreaTokens.inlineRenameMaxHeightPx)}px`;
    input.style.overflowY = input.scrollHeight > themeTextAreaTokens.inlineRenameMaxHeightPx
      ? themeTextAreaTokens.overflowAuto
      : themeTextAreaTokens.overflowHidden;
  }, [value]);

  useEffect(() => {
    if (!selectOnMount) {
      return;
    }

    const input = inputRef.current;
    if (!input) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      input.focus();
      input.select();
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [selectOnMount]);

  return (
    <textarea
      {...props}
      ref={inputRef}
      spellCheck={false}
      rows={1}
      wrap="soft"
      value={value}
      onChange={(event) => onValueChange(event.target.value.replace(/[\r\n]+/g, ' '))}
      onBlur={() => void onSubmit()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          void onSubmit();
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      className={[
        'resize-none overflow-hidden whitespace-pre-wrap break-words',
        className,
      ].filter(Boolean).join(' ')}
    />
  );
}
