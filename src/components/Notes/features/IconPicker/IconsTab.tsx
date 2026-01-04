/**
 * IconsTab - Icon picker tab with category navigation
 */

import { useMemo, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { VirtualIconGrid } from './VirtualIconGrid';
import { ICON_CATEGORIES } from './icons';

interface IconsTabProps {
  recentIcons: string[];
  onSelect: (iconName: string, color: string) => void;
  onPreview?: (icon: string | null) => void;
}

export function IconsTab({
  recentIcons,
  onSelect,
  onPreview,
}: IconsTabProps) {
  const [activeIconCategory, setActiveIconCategory] = useState<string>('common');

  const recentIconsList = useMemo(() => 
    recentIcons.filter(i => i.startsWith('icon:')), 
    [recentIcons]
  );

  const currentIconCategory = useMemo(() => {
    return ICON_CATEGORIES.find(c => c.id === activeIconCategory) || ICON_CATEGORIES[0];
  }, [activeIconCategory]);

  const handleIconCategoryChange = useCallback((categoryId: string) => {
    setActiveIconCategory(categoryId);
  }, []);

  const handlePreview = useCallback((icon: string | null) => {
    onPreview?.(icon);
  }, [onPreview]);

  return (
    <div>
      <VirtualIconGrid
        icons={currentIconCategory.icons}
        onSelect={onSelect}
        onPreview={handlePreview}
        recentIcons={recentIconsList}
        categoryName={currentIconCategory.name}
      />
      <div className="flex items-center justify-around px-2 py-1.5 border-t border-[var(--neko-border)] bg-zinc-50 dark:bg-zinc-800/50">
        {ICON_CATEGORIES.map((category) => {
          const IconComponent = typeof category.emoji !== 'string' 
            ? category.emoji as React.ComponentType<{ size?: number; className?: string }> 
            : null;
          return (
            <button
              key={category.id}
              onClick={() => handleIconCategoryChange(category.id)}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-md text-lg transition-colors",
                activeIconCategory === category.id
                  ? "bg-zinc-200 dark:bg-zinc-700"
                  : "hover:bg-zinc-200 dark:hover:bg-zinc-700"
              )}
            >
              {IconComponent ? (
                <IconComponent size={18} className="text-[#f59e0b]" />
              ) : (
                category.emoji as string
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
