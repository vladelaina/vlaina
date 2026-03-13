import { forwardRef, useLayoutEffect, useRef } from 'react';
import type { ComponentPropsWithoutRef, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const fieldShellClassName =
  'rounded-2xl border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors focus-within:border-zinc-300 dark:border-white/10 dark:bg-[#202020] dark:focus-within:border-white/15';

interface SettingsTextInputProps extends ComponentPropsWithoutRef<'input'> {
  leading?: ReactNode;
  trailing?: ReactNode;
  shellClassName?: string;
  inputClassName?: string;
}

export const SettingsTextInput = forwardRef<HTMLInputElement, SettingsTextInputProps>(
  function SettingsTextInput(
    { leading, trailing, shellClassName, inputClassName, className, ...props },
    ref
  ) {
    return (
      <div className={cn(fieldShellClassName, 'relative flex items-center', shellClassName, className)}>
        {leading ? <div className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2">{leading}</div> : null}
        <input
          ref={ref}
          className={cn(
            'block h-11 w-full rounded-2xl border-0 bg-transparent px-4 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-500',
            leading && 'pl-11',
            trailing && 'pr-20',
            inputClassName
          )}
          {...props}
        />
        {trailing ? <div className="absolute inset-y-0 right-2 flex items-center gap-1">{trailing}</div> : null}
      </div>
    );
  }
);

interface SettingsTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  shellClassName?: string;
  textareaClassName?: string;
  autoGrow?: boolean;
}

export const SettingsTextarea = forwardRef<HTMLTextAreaElement, SettingsTextareaProps>(
  function SettingsTextarea(
    { shellClassName, textareaClassName, className, autoGrow = false, value, onChange, ...props },
    ref
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const attachRef = (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const syncHeight = () => {
      if (!autoGrow || !innerRef.current) {
        return;
      }
      innerRef.current.style.height = '0px';
      innerRef.current.style.height = `${innerRef.current.scrollHeight}px`;
    };

    useLayoutEffect(() => {
      syncHeight();
    }, [autoGrow, value]);

    return (
      <div className={cn(fieldShellClassName, shellClassName, className)}>
        <textarea
          ref={attachRef}
          value={value}
          onChange={(event) => {
            onChange?.(event);
            syncHeight();
          }}
          className={cn(
            'block w-full rounded-2xl border-0 bg-transparent px-4 py-3 text-[14px] leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-500',
            autoGrow && 'min-h-0 resize-none overflow-y-auto',
            textareaClassName
          )}
          {...props}
        />
      </div>
    );
  }
);
