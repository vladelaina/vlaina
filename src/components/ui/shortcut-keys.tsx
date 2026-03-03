import { cn } from '@/lib/utils';

const MAC_KEY_MAP: Record<string, string> = {
  Ctrl: '⌘',
  Control: '⌘',
  Meta: '⌘',
  Alt: '⌥',
  Option: '⌥',
};

export const COMPACT_SHORTCUT_KEY_CLASSNAME =
  'px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-700 text-zinc-100 font-sans';

interface ShortcutKeysProps {
  keys: string[];
  className?: string;
  keyClassName?: string;
  adaptToPlatform?: boolean;
}

function normalizeShortcutKey(key: string, isMac: boolean): string {
  const normalized = key.trim();
  if (!isMac) {
    return normalized;
  }
  return MAC_KEY_MAP[normalized] ?? normalized;
}

export function ShortcutKeys({
  keys,
  className,
  keyClassName,
  adaptToPlatform = true,
}: ShortcutKeysProps) {
  const isMac =
    adaptToPlatform &&
    typeof window !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {keys.map((key, index) => (
        <kbd key={`${key}-${index}`} className={cn(COMPACT_SHORTCUT_KEY_CLASSNAME, keyClassName)}>
          {normalizeShortcutKey(key, isMac)}
        </kbd>
      ))}
    </span>
  );
}
