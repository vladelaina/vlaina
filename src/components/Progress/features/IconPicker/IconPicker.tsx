import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { IconGridView } from './IconGridView';
import { getIconByName } from './utils';
import { useClickOutside } from '@/hooks/useClickOutside';

export interface IconPickerProps {
  value?: string;
  onChange: (icon: string | undefined) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useClickOutside(containerRef, () => setOpen(false), open);

  const SelectedIcon = value ? getIconByName(value) : null;

  return (
    <div className="relative z-50" ref={containerRef}>
      {/* Trigger Button */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className={`
          relative w-14 h-14 flex items-center justify-center rounded-full transition-all duration-300
          ${SelectedIcon 
            ? 'bg-white dark:bg-zinc-800 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:ring-white/10' 
            : 'bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-700 shadow-sm hover:shadow-md'
          }
        `}
      >
        {SelectedIcon ? (
          <div className="text-zinc-900 dark:text-zinc-100">
             <SelectedIcon className="size-6" strokeWidth={1.5} />
          </div>
        ) : (
          <Sparkles className="size-6 text-zinc-400 dark:text-zinc-500 opacity-80" strokeWidth={1.5} />
        )}
        
        {open && (
           <motion.div 
             layoutId="active-ring"
             className="absolute -inset-1 rounded-full border border-zinc-900/20 dark:border-zinc-100/20 opacity-100 pointer-events-none"
             initial={{ opacity: 0, scale: 0.8 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.8 }}
           />
        )}
      </motion.button>

      {/* Center Stage Icon Panel (Fixed Overlay) */}
      <AnimatePresence>
        {open && (
          <>
            <div 
                className="fixed inset-0 z-[60]" 
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
            />

            {/* The Floating Palette */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 850, damping: 35, mass: 0.5 }}
              className="
                fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70]
                w-[380px] max-h-[600px] 
                bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl 
                rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] 
                border border-white/40 dark:border-white/10
                overflow-hidden
                flex flex-col
              "
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 h-full overflow-hidden flex flex-col">
                 <IconGridView 
                    value={value} 
                    onChange={(v) => { onChange(v); setOpen(false); }} 
                    onCancel={() => setOpen(false)} 
                 />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
