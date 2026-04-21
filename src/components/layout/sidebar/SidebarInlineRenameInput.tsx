import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';

interface SidebarInlineRenameInputProps
  extends Omit<
    ComponentPropsWithoutRef<'input'>,
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
  const inputRef = useRef<HTMLInputElement>(null);

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
    <input
      {...props}
      ref={inputRef}
      type="text"
      spellCheck={false}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
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
      className={className}
    />
  );
}
