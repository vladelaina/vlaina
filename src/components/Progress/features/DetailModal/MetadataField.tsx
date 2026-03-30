import type { ReactNode } from 'react';

interface MetadataFieldProps {
  label: string;
  isEditing: boolean;
  onStartEdit: () => void;
  children: ReactNode;
  displayValue: ReactNode;
  isEmpty?: boolean;
  className?: string;
  displayClassName?: string;
}

export function MetadataField({
  label,
  isEditing,
  onStartEdit,
  children,
  displayValue,
  isEmpty = false,
  className = '',
  displayClassName = '',
}: MetadataFieldProps) {
  return (
    <div className={`flex flex-col items-center gap-1 group ${className}`}>
      <span className="text-[9px] font-bold uppercase text-zinc-300 dark:text-zinc-600 tracking-[0.25em]">
        {label}
      </span>
      {isEditing ? (
        children
      ) : (
        <span
          onClick={onStartEdit}
          className={`
            text-xl font-medium cursor-pointer transition-colors
            ${
              isEmpty
                ? 'text-zinc-200 dark:text-zinc-700 group-hover:text-zinc-400'
                : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100'
            }
            ${displayClassName}
          `}
        >
          {displayValue}
        </span>
      )}
    </div>
  );
}

interface MetadataInputProps {
  type?: 'text' | 'number';
  value: string | number;
  onChange: (value: string | number) => void;
  onCommit: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}

export function MetadataInput({
  type = 'text',
  value,
  onChange,
  onCommit,
  autoFocus = false,
  placeholder,
  className = 'w-full min-w-[80px]', // Adaptive width
}: MetadataInputProps) {
  return (
    <input
      autoFocus={autoFocus}
      type={type}
      value={value}
      onChange={(e) =>
        onChange(type === 'number' ? Number(e.target.value) : e.target.value)
      }
      className={`
        bg-transparent border-none outline-none text-center
        font-medium text-xl text-zinc-900 dark:text-zinc-100
        p-0
        placeholder:text-zinc-200 dark:placeholder:text-zinc-700
        ${className}
      `}
      placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          onCommit();
        }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
