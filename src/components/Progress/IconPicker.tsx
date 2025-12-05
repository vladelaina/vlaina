import { useState, useRef, useEffect } from 'react';
import {
  Book, Dumbbell, Target, TrendingUp, Heart, Brain,
  Coffee, Music, Palette, Camera, Code, Gamepad2,
  Bike, Car, Plane, Home, Briefcase, GraduationCap,
  DollarSign, ShoppingBag, Utensils, Moon, Sun, Zap,
  Star, Flag, Award, Trophy, Clock, Calendar,
  type LucideIcon,
} from 'lucide-react';

// 预设图标列表
const ICONS: { name: string; icon: LucideIcon }[] = [
  { name: 'book', icon: Book },
  { name: 'dumbbell', icon: Dumbbell },
  { name: 'target', icon: Target },
  { name: 'trending-up', icon: TrendingUp },
  { name: 'heart', icon: Heart },
  { name: 'brain', icon: Brain },
  { name: 'coffee', icon: Coffee },
  { name: 'music', icon: Music },
  { name: 'palette', icon: Palette },
  { name: 'camera', icon: Camera },
  { name: 'code', icon: Code },
  { name: 'gamepad', icon: Gamepad2 },
  { name: 'bike', icon: Bike },
  { name: 'car', icon: Car },
  { name: 'plane', icon: Plane },
  { name: 'home', icon: Home },
  { name: 'briefcase', icon: Briefcase },
  { name: 'graduation', icon: GraduationCap },
  { name: 'dollar', icon: DollarSign },
  { name: 'shopping', icon: ShoppingBag },
  { name: 'utensils', icon: Utensils },
  { name: 'moon', icon: Moon },
  { name: 'sun', icon: Sun },
  { name: 'zap', icon: Zap },
  { name: 'star', icon: Star },
  { name: 'flag', icon: Flag },
  { name: 'award', icon: Award },
  { name: 'trophy', icon: Trophy },
  { name: 'clock', icon: Clock },
  { name: 'calendar', icon: Calendar },
];

// 根据名称获取图标组件
export function getIconByName(name: string): LucideIcon | null {
  const found = ICONS.find(i => i.name === name);
  return found?.icon || null;
}

interface IconPickerProps {
  value?: string;
  onChange: (icon: string | undefined) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const SelectedIcon = value ? getIconByName(value) : null;

  return (
    <div ref={containerRef} className="relative">
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-9 h-9 flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
      >
        {SelectedIcon ? (
          <SelectedIcon className="size-4 text-zinc-600 dark:text-zinc-400" />
        ) : (
          <span className="text-zinc-300 dark:text-zinc-600 text-lg">○</span>
        )}
      </button>

      {/* 下拉选择器 */}
      {open && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 w-[200px]">
          {/* 无图标选项 */}
          <button
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 mb-1 ${
              !value ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'
            }`}
          >
            无图标
          </button>
          
          {/* 图标网格 */}
          <div className="grid grid-cols-6 gap-1">
            {ICONS.map(({ name, icon: Icon }) => (
              <button
                key={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={`p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${
                  value === name ? 'bg-zinc-100 dark:bg-zinc-700' : ''
                }`}
              >
                <Icon className="size-4 text-zinc-600 dark:text-zinc-400" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
