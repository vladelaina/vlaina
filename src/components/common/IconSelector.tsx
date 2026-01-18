/**
 * IconSelector - Compact icon selector using UniversalIconPicker
 */

import { useState } from 'react';
import { Ban, MoreHorizontal } from 'lucide-react';
import { UniversalIconPicker } from '@/components/common/UniversalIconPicker';
import { AppIcon } from '@/components/common/AppIcon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { type CustomIcon } from '@/lib/storage/unifiedStorage';

interface IconSelectorProps {
  value?: string;
  onChange: (icon: string | undefined) => void;
  onHover?: (icon: string | null) => void;
  closeOnSelect?: boolean;
  color?: string; // Force color for icon
  compact?: boolean;
  
  // Upload & Custom Icons
  customIcons?: CustomIcon[];
  onUploadFile?: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  onDeleteCustomIcon?: (id: string) => void;
  imageLoader?: (src: string) => Promise<string>;
}

const QUICK_ICONS = [
  'coffee', 'book', 'code', 'briefcase', 'heart', 'flame', 
  'music', 'gamepad', 'home', 'car', 'plane', 'wallet',
];

export function IconSelector({ 
  value, 
  onChange, 
  onHover, 
  closeOnSelect = true, 
  color, 
  compact = false,
  customIcons,
  onUploadFile,
  onDeleteCustomIcon,
  imageLoader
}: IconSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (icon: string | undefined) => {
    onChange(icon);
    if (closeOnSelect) {
      setIsOpen(false);
    }
  };

  const handlePreview = (icon: string | null) => {
      onHover?.(icon);
  };

  if (compact) {
     return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Change icon"
                onMouseEnter={() => handlePreview(value || null)}
                onMouseLeave={() => handlePreview(null)}
              >
                {value ? (
                  <AppIcon icon={value} size={14} color={color} />
                ) : (
                  <span className="size-3.5 text-zinc-400 dark:text-zinc-500">✦</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent 
                className="w-auto p-0 border-none bg-transparent shadow-none" 
                side="bottom" 
                align="start"
                data-no-auto-close
            >
                 <UniversalIconPicker
                    onSelect={handleSelect}
                    onPreview={handlePreview}
                    onClose={() => setIsOpen(false)}
                    currentIcon={value}
                    embedded
                    customIcons={compact ? undefined : customIcons}
                    onUploadFile={onUploadFile}
                    onDeleteCustomIcon={onDeleteCustomIcon}
                    imageLoader={imageLoader}
                 />
            </PopoverContent>
        </Popover>
     );
  }

  // Full expanded version (for Context Menus)
  return (
    <div className="py-1" onMouseLeave={() => handlePreview(null)}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => handleSelect(undefined)}
          onMouseEnter={() => handlePreview(null)}
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center transition-all",
            !value 
              ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400" 
              : "text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          )}
          title="Clear icon"
        >
          <Ban className="size-3.5" strokeWidth={1.5} />
        </button>
        
        {QUICK_ICONS.slice(0, 6).map((name) => (
            <button
              key={name}
              onClick={() => handleSelect(name)}
              onMouseEnter={() => handlePreview(name)}
              className={cn(
                "w-6 h-6 rounded-md flex items-center justify-center transition-all",
                 value === name 
                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300" 
                  : "text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
               <AppIcon icon={name} size={14} color={color} />
            </button>
        ))}
        
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                  className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center transition-all text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    isOpen && "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                  )}
                  title="More icons"
                >
                    <MoreHorizontal className="size-3.5" />
                </button>
            </PopoverTrigger>
            <PopoverContent 
                className="w-auto p-0 border-none bg-transparent shadow-none" 
                side="right" 
                align="start"
                data-no-auto-close
            >
                 <UniversalIconPicker
                    onSelect={handleSelect}
                    onPreview={handlePreview}
                    onClose={() => setIsOpen(false)}
                    currentIcon={value}
                    embedded
                    customIcons={customIcons}
                    onUploadFile={onUploadFile}
                    onDeleteCustomIcon={onDeleteCustomIcon}
                    imageLoader={imageLoader}
                 />
            </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}