/**
 * IconsTab - Icon picker tab with search, color picker and category navigation
 */

import { useRef, useMemo, useCallback, useState } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [previewColor, setPreviewColor] = useState<number | null>(null);

  const updateAllIconColors = useNotesStore(s => s.updateAllIconColors);
  const setNotesPreviewIconColor = useUIStore(s => s.setNotesPreviewIconColor);

  const effectiveColor = previewColor !== null ? previewColor : iconColor;
  const currentColor = ICON_COLORS[effectiveColor]?.color || ICON_COLORS[0].color;

  // 使用 ref 存储 onPreview，避免回调变化导致子组件重渲染
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;

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

  // 稳定的 handlePreview 回调
  const handlePreview = useCallback((icon: string | null) => {
    onPreviewRef.current?.(icon);
  }, []);

  // 获取当前图标的名称（如果是 icon 类型）
  const getIconWithColor = useCallback((icon: string | undefined, color: string): string | null => {
    if (!icon || !icon.startsWith('icon:')) return null;
    const parts = icon.split(':');
    const iconName = parts[1];
    return `icon:${iconName}:${color}`;
  }, []);

  const handleColorHover = useCallback((colorId: number | null) => {
    setPreviewColor(colorId);
    if (colorId !== null) {
      const color = ICON_COLORS[colorId]?.color || ICON_COLORS[0].color;
      setNotesPreviewIconColor(color);
      // 同时预览当前笔记的图标
      if (currentIcon && currentIcon.startsWith('icon:')) {
        const previewIcon = getIconWithColor(currentIcon, color);
        if (previewIcon) {
          onPreview?.(previewIcon);
        }
      }
    } else {
      setNotesPreviewIconColor(null);
      onPreview?.(null);
    }
  }, [currentIcon, getIconWithColor, onPreview, setNotesPreviewIconColor]);

  const handleColorChange = useCallback((colorId: number) => {
    setIconColor(colorId);
    saveIconColor(colorId);
    setShowColorPicker(false);
    setPreviewColor(null);
    setNotesPreviewIconColor(null);
    onPreview?.(null);
    // 更新所有笔记的 icon 颜色
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
            <div className={cn(
              "absolute right-0 top-full mt-1 p-2 rounded-lg shadow-lg z-10",
              "bg-white dark:bg-zinc-800 border border-[var(--neko-border)]",
              "flex gap-1"
            )}>
              {ICON_COLORS.map((ic) => (
                <button
                  key={ic.id}
                  onClick={() => handleColorChange(ic.id)}
                  onMouseEnter={() => handleColorHover(ic.id)}
                  onMouseLeave={() => handleColorHover(null)}
                  className={cn(
                    "w-7 h-7 flex items-center justify-center transition-all",
                    iconColor === ic.id
                      ? "opacity-100 scale-110"
                      : "opacity-60 hover:opacity-100 hover:scale-105"
                  )}
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
