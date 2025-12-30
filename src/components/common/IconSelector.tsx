/**
 * IconSelector - 紧凑型图标选择器
 * 
 * 用于右键菜单中的图标选择，复用 Progress 模块的图标数据
 */

import { useState } from 'react';
import { Prohibit, X } from '@phosphor-icons/react';
import { ICON_CATEGORIES_FULL } from '@/components/Progress/features/IconPicker/fullIcons';
import { getIconByName } from '@/components/Progress/features/IconPicker/utils';

interface IconSelectorProps {
  value?: string;
  onChange: (icon: string | undefined) => void;
  /** 鼠标悬停时的回调，用于实时预览。传入 null 表示鼠标离开，停止预览 */
  onHover?: (icon: string | undefined | null) => void;
  /** 是否在选择后自动关闭（默认 true） */
  closeOnSelect?: boolean;
  /** 图标颜色（用于紧凑模式显示当前图标） */
  color?: string;
  /** 紧凑模式：只显示当前图标，点击展开选择器 */
  compact?: boolean;
}

// 常用图标（快捷栏显示）
const QUICK_ICONS = [
  'coffee', 'book', 'code', 'briefcase', 'heart', 'flame', 
  'music-note', 'game-controller', 'house', 'car', 'airplane', 'shopping-bag',
];

// 自定义"常用"分类 - 针对日历和待办场景精选
const FEATURED_ICONS = [
  // 日常生活
  'coffee', 'bed', 'house', 'shower', 'cooking-pot', 'fork-knife',
  // 工作学习
  'briefcase', 'book', 'graduation-cap', 'laptop', 'code', 'presentation-chart',
  // 运动健康
  'barbell', 'heart', 'person-simple-run', 'bicycle', 'soccer-ball', 'swimming-pool',
  // 娱乐休闲
  'music-note', 'game-controller', 'film-strip', 'headphones', 'palette', 'guitar',
  // 社交通讯
  'phone', 'chat-circle', 'envelope', 'users', 'video-camera', 'handshake',
  // 出行旅游
  'airplane', 'car', 'train', 'map-pin', 'suitcase', 'compass',
  // 购物消费
  'shopping-cart', 'shopping-bag', 'credit-card', 'receipt', 'gift', 'tag',
  // 时间日程
  'calendar', 'clock', 'alarm', 'timer', 'hourglass', 'bell',
  // 目标成就
  'target', 'trophy', 'star', 'flag', 'check-circle', 'rocket',
  // 情绪状态
  'smiley', 'heart', 'fire', 'lightning', 'sun', 'moon',
];

export function IconSelector({ value, onChange, onHover, closeOnSelect = true, color, compact = false }: IconSelectorProps) {
  const [showAll, setShowAll] = useState(false);

  const handleSelect = (icon: string | undefined) => {
    onChange(icon);
    if (closeOnSelect) {
      setShowAll(false);
    }
  };

  // 鼠标悬停时调用 onHover
  const handleHover = (icon: string | undefined) => {
    onHover?.(icon);
  };

  // 鼠标离开时传递 null 表示停止预览
  const handleMouseLeave = () => {
    onHover?.(null);
  };

  // Compact mode: show only current icon, click to expand
  if (compact && !showAll) {
    const CurrentIcon = value ? getIconByName(value) : null;
    return (
      <button
        onClick={() => setShowAll(true)}
        className="w-4 h-4 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        style={{ color: color || undefined }}
        title="Change icon"
      >
        {CurrentIcon ? (
          <CurrentIcon className="size-3.5" weight="duotone" />
        ) : (
          <span className="size-3.5 text-zinc-400 dark:text-zinc-500">✦</span>
        )}
      </button>
    );
  }

  return (
    <div className="py-1" onMouseLeave={handleMouseLeave}>
      {/* Quick icons row - 始终显示 */}
      <div className="flex items-center gap-1.5">
        {/* Clear button - 清除图标 */}
        <button
          onClick={() => handleSelect(undefined)}
          onMouseEnter={() => handleHover(undefined)}
          className={`
            w-6 h-6 rounded-md flex items-center justify-center transition-all
            ${!value 
              ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400' 
              : 'text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-400'
            }
          `}
          title="清除图标"
        >
          <Prohibit className="size-3.5" weight="light" />
        </button>
        
        {/* Quick icons */}
        {QUICK_ICONS.slice(0, 6).map((name) => {
          const Icon = getIconByName(name);
          if (!Icon) return null;
          return (
            <button
              key={name}
              onClick={() => handleSelect(name)}
              onMouseEnter={() => handleHover(name)}
              className={`
                w-6 h-6 rounded-md flex items-center justify-center transition-all
                ${value === name 
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300' 
                  : 'text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-400'
                }
              `}
            >
              <Icon className="size-3.5" weight={value === name ? 'duotone' : 'light'} />
            </button>
          );
        })}
        
        {/* More/Collapse button */}
        <button
          onClick={() => setShowAll(!showAll)}
          onMouseEnter={() => handleHover(value)}
          className={`
            w-6 h-6 rounded-md flex items-center justify-center transition-all text-[10px] font-medium
            ${showAll 
              ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300' 
              : 'text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-400'
            }
          `}
        >
          {showAll ? <X className="size-3" /> : '···'}
        </button>
      </div>
      
      {/* Expanded icons grid - 在快捷图标下方展开，自适应宽度 */}
      {showAll && (
        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="max-h-72 overflow-y-auto space-y-3">
            {/* 自定义常用分类 - 放在最前面 */}
            <div>
              <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wide mb-1.5 sticky top-0 bg-white dark:bg-zinc-900 py-0.5">
                ⭐ Featured
              </div>
              <div 
                className="grid gap-1"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(32px, 1fr))' }}
              >
                {FEATURED_ICONS.map((name) => {
                  const Icon = getIconByName(name);
                  if (!Icon) return null;
                  return (
                    <button
                      key={name}
                      onClick={() => handleSelect(name)}
                      onMouseEnter={() => handleHover(name)}
                      className={`
                        aspect-square rounded-md flex items-center justify-center transition-all
                        ${value === name 
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' 
                          : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }
                      `}
                      title={name}
                    >
                      <Icon className="size-5" weight={value === name ? 'duotone' : 'light'} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 其他分类 */}
            {ICON_CATEGORIES_FULL.map((category) => (
              <div key={category.name}>
                <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wide mb-1.5 sticky top-0 bg-white dark:bg-zinc-900 py-0.5">
                  {category.name}
                </div>
                {/* 使用 auto-fill 自适应宽度，每个图标最小 32px */}
                <div 
                  className="grid gap-1"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(32px, 1fr))' }}
                >
                  {category.icons.map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      onClick={() => handleSelect(name)}
                      onMouseEnter={() => handleHover(name)}
                      className={`
                        aspect-square rounded-md flex items-center justify-center transition-all
                        ${value === name 
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' 
                          : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }
                      `}
                      title={name}
                    >
                      <Icon className="size-5" weight={value === name ? 'duotone' : 'light'} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
