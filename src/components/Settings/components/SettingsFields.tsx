import { forwardRef, useRef } from 'react';
import type { ComponentPropsWithoutRef, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { usePredictedTextareaHeight } from '@/hooks/usePredictedTextareaHeight';

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
          spellCheck={false}
          className={cn(
            'block h-11 w-full rounded-2xl border-0 bg-transparent px-4 text-[14px] text-[var(--chat-sidebar-text)] outline-none placeholder:text-[var(--chat-sidebar-text-soft)] focus:ring-0',
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
    const textareaValue = typeof value === 'string'
      ? value
      : Array.isArray(value)
        ? value.join('\n')
        : '';

    const attachRef = (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    usePredictedTextareaHeight(innerRef, {
      value: textareaValue,
      minHeight: 0,
      maxHeight: autoGrow ? 100000 : 0,
    });

    return (
      <div className={cn(fieldShellClassName, shellClassName, className)}>
        <textarea
          ref={attachRef}
          value={value}
          onChange={onChange}
          spellCheck={false}
          className={cn(
            'block w-full rounded-2xl border-0 bg-transparent px-4 py-3 text-[14px] leading-6 text-[var(--chat-sidebar-text)] outline-none placeholder:text-[var(--chat-sidebar-text-soft)] focus:ring-0',
            autoGrow && 'min-h-0 resize-none overflow-y-auto',
            textareaClassName
          )}
          {...props}
        />
      </div>
    );
  }
);

interface SettingsSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  'aria-label'?: string;
}

export function SettingsSwitch({ checked, onChange, className, 'aria-label': ariaLabel }: SettingsSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none',
        checked ? 'bg-[#10B981]' : 'bg-zinc-200 dark:bg-zinc-700',
        className
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        )}
      />
    </button>
  );
}
