/**
 * EditorToolbar - Formatting toolbar for the Markdown editor
 * 
 * Provides quick access to common formatting options
 */

import { 
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconCode,
  IconList,
  IconListNumbers,
  IconQuote,
  IconLink,
  IconPhoto,
  IconMinus
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  title: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
}

function ToolbarButton({ icon, title, shortcut, onClick, active }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={shortcut ? `${title} (${shortcut})` : title}
      className={cn(
        "p-1.5 rounded transition-colors",
        active 
          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
          : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300"
      )}
    >
      {icon}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />;
}

interface EditorToolbarProps {
  onFormat: (format: string) => void;
}

export function EditorToolbar({ onFormat }: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
      {/* Text formatting */}
      <ToolbarButton
        icon={<IconBold className="size-4" />}
        title="Bold"
        shortcut="Ctrl+B"
        onClick={() => onFormat('bold')}
      />
      <ToolbarButton
        icon={<IconItalic className="size-4" />}
        title="Italic"
        shortcut="Ctrl+I"
        onClick={() => onFormat('italic')}
      />
      <ToolbarButton
        icon={<IconStrikethrough className="size-4" />}
        title="Strikethrough"
        onClick={() => onFormat('strikethrough')}
      />
      <ToolbarButton
        icon={<IconCode className="size-4" />}
        title="Inline Code"
        onClick={() => onFormat('code')}
      />

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        icon={<IconList className="size-4" />}
        title="Bullet List"
        onClick={() => onFormat('bulletList')}
      />
      <ToolbarButton
        icon={<IconListNumbers className="size-4" />}
        title="Numbered List"
        onClick={() => onFormat('numberedList')}
      />

      <ToolbarDivider />

      {/* Block elements */}
      <ToolbarButton
        icon={<IconQuote className="size-4" />}
        title="Blockquote"
        onClick={() => onFormat('blockquote')}
      />
      <ToolbarButton
        icon={<IconMinus className="size-4" />}
        title="Horizontal Rule"
        onClick={() => onFormat('hr')}
      />

      <ToolbarDivider />

      {/* Links and media */}
      <ToolbarButton
        icon={<IconLink className="size-4" />}
        title="Insert Link"
        onClick={() => onFormat('link')}
      />
      <ToolbarButton
        icon={<IconPhoto className="size-4" />}
        title="Insert Image"
        onClick={() => onFormat('image')}
      />
    </div>
  );
}
