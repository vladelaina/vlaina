/**
 * IconSelector - Compact icon selector for context menus
 */

import { useState } from 'react';
import { Ban, X } from 'lucide-react';
import { ICON_CATEGORIES_FULL } from '@/components/Progress/features/IconPicker/icons';
import { getIconByName } from '@/components/Progress/features/IconPicker/utils';

interface IconSelectorProps {
  value?: string;
  onChange: (icon: string | undefined) => void;
  onHover?: (icon: string | undefined | null) => void;
  closeOnSelect?: boolean;
  color?: string;
  compact?: boolean;
}

const QUICK_ICONS = [
  'coffee', 'book', 'code', 'briefcase', 'heart', 'flame', 
  'music', 'gamepad', 'home', 'car', 'plane', 'wallet',
];

const FEATURED_ICONS = [
  'coffee', 'home', 'kitchen', 'chef',
  'briefcase', 'book', 'laptop', 'code',
  'barbell', 'heart', 'run', 'bike',
  'music', 'gamepad', 'movie', 'headphones',
  'phone', 'messagecircle', 'mail', 'users',
  'plane', 'car', 'train', 'mappin',
  'wallet', 'creditcard', 'receipt', 'gift',
  'calendar', 'clock', 'alarm', 'hourglass',
  'target', 'trophy', 'star', 'flag',
  'moodsmile', 'heart', 'flame', 'sun',
];

export function IconSelector({ value, onChange, onHover, closeOnSelect = true, color, compact = false }: IconSelectorProps) {
  const [showAll, setShowAll] = useState(false);

  const handleSelect = (icon: string | undefined) => {
    onChange(icon);
    if (closeOnSelect) {
      setShowAll(false);
    }
  };

  const handleHover = (icon: string | undefined) => {
    onHover?.(icon);
  };

  const handleMouseLeave = () => {
    onHover?.(null);
  };

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
          <CurrentIcon className="size-3.5" strokeWidth={1.5} />
        ) : (
          <span className="size-3.5 text-zinc-400 dark:text-zinc-500">✦</span>
        )}
      </button>
    );
  }

  return (
    <div className="py-1" onMouseLeave={handleMouseLeave}>
      <div className="flex items-center gap-1.5">
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
          title="Clear icon"
        >
          <Ban className="size-3.5" strokeWidth={1.5} />
        </button>
        
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
              <Icon className="size-3.5" strokeWidth={value === name ? 2 : 1.5} />
            </button>
          );
        })}
        
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
      
      {showAll && (
        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="max-h-72 overflow-y-auto space-y-3">
            <div>
              <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wide mb-1.5 sticky top-0 bg-white dark:bg-zinc-900 py-0.5">
                Featured
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
                      <Icon className="size-5" strokeWidth={value === name ? 2 : 1.5} />
                    </button>
                  );
                })}
              </div>
            </div>

            {ICON_CATEGORIES_FULL.map((category) => (
              <div key={category.name}>
                <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wide mb-1.5 sticky top-0 bg-white dark:bg-zinc-900 py-0.5">
                  {category.name}
                </div>
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
                      <Icon className="size-5" strokeWidth={value === name ? 2 : 1.5} />
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
