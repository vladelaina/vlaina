import { useState, useRef, useEffect } from 'react';
import {
  // Activity
  Dumbbell, Target, TrendingUp, Zap, Trophy, Award, Flag, Activity, Flame,
  // Health & Mind
  Heart, Brain, Moon, Sun, Coffee, Smile, Sparkles,
  // Work & Study
  Briefcase, GraduationCap, Book, Pen, Code, Laptop,
  // Life
  Home, Music, Camera, Gamepad2, ShoppingBag, Utensils, Gift, Ticket,
  // Travel
  Plane, Car, Bike, Map, Compass, Globe,
  // Finance
  DollarSign, PiggyBank,
  // Nature
  Leaf, Flower, Droplets,
  // Tools
  Clock, Calendar,
  type LucideIcon,
  Sparkle,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Categorized Icons
const ICON_CATEGORIES = [
  {
    name: 'Activity',
    icons: [
      { name: 'dumbbell', icon: Dumbbell },
      { name: 'activity', icon: Activity },
      { name: 'flame', icon: Flame },
      { name: 'target', icon: Target },
      { name: 'trending-up', icon: TrendingUp },
      { name: 'trophy', icon: Trophy },
      { name: 'award', icon: Award },
      { name: 'flag', icon: Flag },
      { name: 'zap', icon: Zap },
    ]
  },
  {
    name: 'Life',
    icons: [
      { name: 'home', icon: Home },
      { name: 'coffee', icon: Coffee },
      { name: 'music', icon: Music },
      { name: 'gamepad', icon: Gamepad2 },
      { name: 'camera', icon: Camera },
      { name: 'shopping', icon: ShoppingBag },
      { name: 'utensils', icon: Utensils },
      { name: 'gift', icon: Gift },
      { name: 'ticket', icon: Ticket },
    ]
  },
  {
    name: 'Growth',
    icons: [
      { name: 'book', icon: Book },
      { name: 'brain', icon: Brain },
      { name: 'graduation', icon: GraduationCap },
      { name: 'briefcase', icon: Briefcase },
      { name: 'code', icon: Code },
      { name: 'laptop', icon: Laptop },
      { name: 'pen', icon: Pen },
      { name: 'sparkles', icon: Sparkles },
      { name: 'dollar', icon: DollarSign },
      { name: 'piggy-bank', icon: PiggyBank },
    ]
  },
  {
    name: 'Health',
    icons: [
      { name: 'heart', icon: Heart },
      { name: 'smile', icon: Smile },
      { name: 'moon', icon: Moon },
      { name: 'sun', icon: Sun },
      { name: 'droplets', icon: Droplets },
      { name: 'leaf', icon: Leaf },
      { name: 'flower', icon: Flower },
    ]
  },
  {
    name: 'Travel',
    icons: [
      { name: 'plane', icon: Plane },
      { name: 'car', icon: Car },
      { name: 'bike', icon: Bike },
      { name: 'map', icon: Map },
      { name: 'compass', icon: Compass },
      { name: 'globe', icon: Globe },
      { name: 'clock', icon: Clock },
      { name: 'calendar', icon: Calendar },
    ]
  }
];

// Flatten for quick lookup
const ALL_ICONS = ICON_CATEGORIES.flatMap(c => c.icons);

export function getIconByName(name: string): LucideIcon | null {
  const found = ALL_ICONS.find(i => i.name === name);
  return found?.icon || null;
}

interface IconPickerProps {
  value?: string;
  onChange: (icon: string | undefined) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
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
    <div ref={containerRef} className="relative z-50">
      {/* Trigger Button */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className={`
          relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300
          ${SelectedIcon 
            ? 'bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10' 
            : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }
        `}
      >
        {SelectedIcon ? (
          <div className="text-zinc-900 dark:text-zinc-100">
             <SelectedIcon className="size-6" strokeWidth={2} fill="currentColor" fillOpacity={0.2} />
          </div>
        ) : (
          <Sparkle className="size-5 text-zinc-400 dark:text-zinc-500" strokeWidth={2} />
        )}
        
        {/* Active Indicator */}
        {open && (
           <motion.div 
             layoutId="active-ring"
             className="absolute -inset-1 rounded-3xl border-2 border-zinc-900 dark:border-zinc-100 opacity-20 pointer-events-none"
           />
        )}
      </motion.button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full left-0 mt-4 p-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl w-[320px] max-h-[400px] overflow-y-auto scrollbar-hide z-50 ring-1 ring-black/5 dark:ring-white/5"
          >
            {/* Header: Clear Button */}
            <div className="flex justify-between items-center mb-4 px-1">
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                Choose Icon
              </span>
              {value && (
                <button
                  onClick={() => { onChange(undefined); setOpen(false); }}
                  className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 rounded-full transition-colors"
                  title="Clear icon"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="space-y-6">
              {ICON_CATEGORIES.map((category) => (
                <div key={category.name}>
                  <div className="text-[10px] font-bold text-zinc-300 dark:text-zinc-600 uppercase tracking-widest mb-3 pl-1">
                    {category.name}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {category.icons.map(({ name, icon: Icon }) => (
                      <button
                        key={name}
                        onClick={() => {
                          onChange(name);
                          setOpen(false);
                        }}
                        className={`
                          group relative p-3 rounded-2xl flex items-center justify-center transition-all duration-200
                          ${value === name 
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg scale-110' 
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:scale-105'
                          }
                        `}
                      >
                        {/* Icon with Duotone-ish feel using fill opacity */}
                        <Icon 
                          className="size-6 transition-transform duration-200" 
                          strokeWidth={2} 
                          fill="currentColor" 
                          fillOpacity={value === name ? 0.2 : 0.1} 
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

