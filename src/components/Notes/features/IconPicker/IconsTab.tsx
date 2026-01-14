/**
 * IconsTab - Icon picker tab with search, color picker and category navigation
 */

import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Search, X, Candy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VirtualIconGrid, VirtualIconSearchResults } from './VirtualIconGrid';
import { ICON_CATEGORIES, ICON_LIST } from './icons';
import { ICON_COLORS, saveIconColor } from './constants';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import type { IconItem } from './icons';

interface IconsTabProps {
  recentIcons: string[];
  onSelect: (iconName: string, color: string) => void;
  onPreview?: (icon: string | null) => void;
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
  iconColor: number;
  setIconColor: (colorId: number) => void;
  currentIcon?: string;
}

export function IconsTab({
  recentIcons,
  onSelect,
  onPreview,
  activeCategory,
  onCategoryChange,
  iconColor,
  setIconColor,
  currentIcon,
}: IconsTabProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [previewColor, setPreviewColor] = useState<number | null>(null);

  const updateAllIconColors = useNotesStore(s => s.updateAllIconColors);
  const setNotesPreviewIconColor = useUIStore(s => s.setNotesPreviewIconColor);

  const effectiveColor = previewColor !== null ? previewColor : iconColor;
  const currentColor = ICON_COLORS[effectiveColor]?.color || ICON_COLORS[0].color;

  // Use ref to store callbacks and state to avoid dependency changes
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;
  
  const currentIconRef = useRef(currentIcon);
  currentIconRef.current = currentIcon;
  
  const iconColorRef = useRef(iconColor);
  iconColorRef.current = iconColor;
  
  const setNotesPreviewIconColorRef = useRef(setNotesPreviewIconColor);
  setNotesPreviewIconColorRef.current = setNotesPreviewIconColor;

  // Track last previewed color to avoid duplicate updates
  const lastPreviewColorRef = useRef<number | null>(null);

  const recentIconsList = useMemo(() => 
    recentIcons.filter(i => i.startsWith('icon:')), 
    [recentIcons]
  );

  const currentIconCategory = useMemo(() => {
    return ICON_CATEGORIES.find(c => c.id === activeCategory) || ICON_CATEGORIES[0];
  }, [activeCategory]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    const results: IconItem[] = [];
    for (const icon of ICON_LIST) {
      if (icon.name.toLowerCase().includes(query)) {
        results.push(icon);
        if (results.length >= 90) break;
      }
    }
    return results;
  }, [searchQuery]);

  // Stable handlePreview callback
  const handlePreview = useCallback((icon: string | null) => {
    onPreviewRef.current?.(icon);
  }, []);

  // Use native event handling for color hover to bypass React synthetic event system
  useEffect(() => {
    const container = colorPickerRef.current;
    if (!container || !showColorPicker) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-color-id]') as HTMLElement;
      if (button?.dataset.colorId) {
        const colorId = parseInt(button.dataset.colorId, 10);
        if (colorId !== lastPreviewColorRef.current) {
          lastPreviewColorRef.current = colorId;
          setPreviewColor(colorId);
          const color = ICON_COLORS[colorId]?.color || ICON_COLORS[0].color;
          setNotesPreviewIconColorRef.current(color);
          // Also preview current note's icon
          const icon = currentIconRef.current;
          if (icon && icon.startsWith('icon:')) {
            const parts = icon.split(':');
            const iconName = parts[1];
            onPreviewRef.current?.(`icon:${iconName}:${color}`);
          }
        }
      }
    };

    const handleMouseLeave = () => {
      if (lastPreviewColorRef.current !== null) {
        lastPreviewColorRef.current = null;
        setPreviewColor(null);
        setNotesPreviewIconColorRef.current(null);
        onPreviewRef.current?.(null);
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [showColorPicker]);

  const handleColorChange = useCallback((colorId: number) => {
    setIconColor(colorId);
    saveIconColor(colorId);
    setShowColorPicker(false);
    setPreviewColor(null);
    lastPreviewColorRef.current = null;
    setNotesPreviewIconColor(null);
    onPreview?.(null);
    // Update all notes' icon colors
    const newColor = ICON_COLORS[colorId]?.color || ICON_COLORS[0].color;
    updateAllIconColors(newColor);
  }, [setIconColor, updateAllIconColors, onPreview, setNotesPreviewIconColor]);

  return (
    <div>
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400 dark:text-zinc-500" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Filter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full pl-8 py-1.5 text-sm rounded-md",
              searchQuery ? "pr-8" : "pr-3",
              "bg-zinc-100 dark:bg-zinc-800",
              "border border-transparent focus:border-zinc-300 dark:focus:border-zinc-600",
              "outline-none transition-colors"
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-7 h-7 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
          >
            <Candy size={18} style={{ color: ICON_COLORS[iconColor]?.color || ICON_COLORS[0].color }} />
          </button>
          {showColorPicker && (
            <div 
              ref={colorPickerRef}
              className={cn(
                "absolute right-0 top-full mt-1 p-2 rounded-lg shadow-lg z-10",
                "bg-white dark:bg-zinc-800 border border-[var(--neko-border)]",
                "flex gap-1"
              )}
            >
              {ICON_COLORS.map((ic) => (
                <button
                  key={ic.id}
                  data-color-id={ic.id}
                  onClick={() => handleColorChange(ic.id)}
                  className="w-7 h-7 flex items-center justify-center"
                >
                  <Candy size={18} style={{ color: ic.color }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {searchQuery && searchResults ? (
        <VirtualIconSearchResults
          results={searchResults}
          iconColor={currentColor}
          onSelect={onSelect}
          onPreview={handlePreview}
        />
      ) : (
        <VirtualIconGrid
          icons={currentIconCategory.icons}
          onSelect={onSelect}
          onPreview={handlePreview}
          recentIcons={recentIconsList}
          categoryName={currentIconCategory.name}
          iconColor={currentColor}
        />
      )}

      {!searchQuery && (
        <div className="flex items-center justify-around px-2 py-1.5 border-t border-[var(--neko-border)] bg-zinc-50 dark:bg-zinc-800/50">
          {ICON_CATEGORIES.map((category) => {
            const IconComponent = typeof category.emoji !== 'string' 
              ? category.emoji as React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }> 
              : null;
            return (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-md text-lg transition-colors",
                  activeCategory === category.id
                    ? "bg-zinc-200 dark:bg-zinc-700"
                    : "hover:bg-zinc-200 dark:hover:bg-zinc-700"
                )}
              >
                {IconComponent ? (
                  <IconComponent size={18} style={{ color: currentColor }} />
                ) : (
                  category.emoji as string
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
