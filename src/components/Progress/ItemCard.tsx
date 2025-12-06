import { useSortable, defaultAnimateLayoutChanges, type AnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Minus, Check } from 'lucide-react';
import type { ProgressOrCounter } from '@/stores/useProgressStore';
import { getIconByName } from './IconPicker';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

// Disable drop animation to prevent "snap back" effect
const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args;
  if (isSorting || wasDragging) {
    return false;
  }
  return defaultAnimateLayoutChanges(args);
};

interface ItemCardProps {
  item: ProgressOrCounter;
  onUpdate: (id: string, delta: number) => void;
  onClick?: () => void;
  onAutoArchive?: (id: string) => void;
  isDragging?: boolean;
  previewIcon?: string;
  previewTitle?: string;
}

/**
 * "Liquid Light" Design - High End, Minimalist, Fluid
 */
export function ItemCard({ item, onUpdate, onClick, onAutoArchive, isDragging, previewIcon, previewTitle }: ItemCardProps) {
  const displayIcon = previewIcon !== undefined ? previewIcon : item.icon;
  const displayTitle = previewTitle !== undefined ? previewTitle : item.title;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: item.id,
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const step = item.type === 'progress'
    ? (item.direction === 'increment' ? item.step : -item.step)
    : item.step;

  const percentage = item.type === 'progress' 
    ? Math.min(100, Math.max(0, (item.current / item.total) * 100))
    : 0;
  
  // Counter fill based on activity (subtle feedback)
  const counterFill = item.type === 'counter'
    ? Math.min(100, (item.todayCount / 8) * 100) // Assuming 8 is a loose "daily goal" for visualization
    : 0;

  const fillWidth = item.type === 'progress' ? `${percentage}%` : `${counterFill}%`;
  const [hoverZone, setHoverZone] = useState<'left' | 'right' | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // If archived, render the "Timeline Ticket" view
  if (item.archived) {
    const startDate = new Date(item.createdAt);
    const endDate = item.lastUpdateDate ? new Date(item.lastUpdateDate) : new Date();
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)));
    
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });

    return (
      <div ref={setNodeRef} style={style} className="relative group">
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={onClick}
          className="
            relative overflow-hidden rounded-2xl
            bg-white dark:bg-zinc-900
            shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] dark:shadow-none
            border border-zinc-100 dark:border-zinc-800
            h-24 select-none cursor-pointer
            grid grid-cols-[1.5fr_2.5fr] gap-8 items-center px-8
            transition-all duration-300
            hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.08)] hover:border-zinc-200 dark:hover:border-zinc-700
          "
        >
           {/* Zone 1: Identity & Result */}
           <div className="flex items-center gap-4 min-w-0 border-r border-zinc-100 dark:border-zinc-800/50 pr-6">
              {displayIcon ? (() => {
                const Icon = getIconByName(displayIcon);
                return Icon ? (
                  <div className="text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors duration-500">
                    <Icon className="size-8" strokeWidth={1.5} />
                  </div>
                ) : null;
              })() : (
                 <div className="size-8 rounded-full border-2 border-zinc-100 dark:border-zinc-800 group-hover:border-zinc-300 transition-colors" />
              )}
              
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-lg font-bold text-zinc-800 dark:text-zinc-100 truncate tracking-tight group-hover:text-black transition-colors">
                  {displayTitle}
                </span>
                <div className="flex items-center gap-2 text-[10px] font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                  <span>Final Count</span>
                  <span className="text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                    {item.type === 'progress' ? `${item.current}/${(item as any).total}` : item.current}
                  </span>
                </div>
              </div>
           </div>

           {/* Zone 2: The Timeline Journey (Now Expanded) */}
           <div className="flex flex-col justify-center gap-2 w-full max-w-md justify-self-end">
              {/* Labels */}
              <div className="flex justify-between text-[9px] font-bold tracking-[0.2em] text-zinc-300 dark:text-zinc-600 uppercase px-1">
                 <span>Started</span>
                 <span>Ended</span>
              </div>

              {/* Visual Timeline */}
              <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400">
                 <span className="text-xs font-medium tabular-nums tracking-wide text-zinc-500 dark:text-zinc-400">
                    {formatDate(startDate)}
                 </span>
                 
                 {/* The Path */}
                 <div className="flex-1 h-px bg-gradient-to-r from-zinc-200 via-zinc-300 to-zinc-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 relative group-hover:from-zinc-300 group-hover:via-zinc-400 group-hover:to-zinc-300 transition-colors duration-500">
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="bg-white dark:bg-zinc-900 px-3 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors duration-500">
                         {durationDays} Days
                       </div>
                    </div>
                 </div>

                 <span className="text-xs font-medium tabular-nums tracking-wide text-zinc-800 dark:text-zinc-200">
                    {formatDate(endDate)}
                 </span>
              </div>
           </div>
        </motion.div>
      </div>
    );
  }

  // Auto-archive logic
  useEffect(() => {
    if (item.type !== 'progress' || item.archived) return;
    
    // Check completion
    const isDone = item.current >= item.total;
    
    if (isDone) {
      setIsCompleting(true);
      const timer = setTimeout(() => {
        if (onAutoArchive) {
          onAutoArchive(item.id);
        }
      }, 1200); // 1.2s moment of satisfaction
      return () => clearTimeout(timer);
    } else {
      setIsCompleting(false);
    }
  }, [item.current, (item as any).total, item.type, item.archived, onAutoArchive, item.id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative"
    >
      <motion.div
        layout
        initial={false}
        animate={isDragging ? { scale: 1.02, boxShadow: "0 20px 40px rgba(0,0,0,0.12)" } : { scale: 1, boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
        whileHover={{ scale: 1.002, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
        className={`
          group relative overflow-hidden rounded-3xl
          bg-white dark:bg-zinc-900 
          h-22 select-none
          ${isDragging ? 'z-50 opacity-95' : ''}
        `}
      >
        {/* Shimmer Effect (The "Wow" Factor) */}
        <AnimatePresence>
          {isCompleting && (
            <motion.div
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: '200%', opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent -skew-x-12"
            />
          )}
        </AnimatePresence>

        {/* Base Layer: Pure White/Black -> Morphs to Premium Solid on Completion */}
        <motion.div 
          className="absolute inset-0 bg-white dark:bg-zinc-900"
          animate={{ 
            backgroundColor: isCompleting ? 'var(--card-complete-bg)' : 'var(--card-bg)'
          }}
          style={{
            // @ts-ignore
            '--card-bg': 'var(--bg-white)',
            '--card-complete-bg': '#18181b', // zinc-900
          }}
        />
        
        {/* Dark Mode Overlay for Completion (Inverted logic for dark theme) */}
        <motion.div 
          className="absolute inset-0 bg-zinc-100 hidden dark:block"
          initial={{ opacity: 0 }}
          animate={{ opacity: isCompleting ? 1 : 0 }}
        />

        {/* Progress Layer: "Light Beam" - Fades out completely on completion */}
        <motion.div 
          className="absolute inset-y-0 left-0 bg-zinc-100/80 dark:bg-zinc-800/60 mix-blend-multiply dark:mix-blend-screen"
          initial={false}
          animate={{ width: fillWidth, opacity: isCompleting ? 0 : 1 }}
          transition={{ duration: 0.6 }}
        />
        
        {/* Delicate Border (Ring) */}
        <div className={`absolute inset-0 rounded-3xl ring-1 ring-inset pointer-events-none transition-colors duration-500 ${isCompleting ? 'ring-transparent' : 'ring-black/5 dark:ring-white/5'}`} />

        {/* Content Layer - The Grand Transformation */}
        <div className="absolute inset-0 flex items-center justify-between px-7 pointer-events-none z-20">
          
          {/* Left Group: Title & Icon */}
          <motion.div 
            className="flex items-center gap-5 min-w-0 flex-1"
            animate={{ 
              x: isCompleting ? '50%' : (hoverZone === 'left' ? 48 : 0), // Center on complete
              opacity: hoverZone === 'left' ? 0.6 : 1 
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            {/* Wrapper to center content relative to itself when moving */}
            <motion.div 
              className="flex items-center gap-5"
              animate={{ x: isCompleting ? '-50%' : '0%' }} // Counter-offset for true centering
            >
                {/* Icon */}
                {displayIcon && (() => {
                  const Icon = getIconByName(displayIcon);
                  return Icon ? (
                    <div className={`transition-colors duration-500 ${isCompleting ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400'}`}>
                      <Icon className="size-6" strokeWidth={2} fill="currentColor" fillOpacity={0.1} />
                    </div>
                  ) : null;
                })()}

                <div className="flex flex-col justify-center min-w-0 gap-0.5">
                  <span className={`text-lg font-medium tracking-tight truncate leading-none transition-colors duration-500 ${isCompleting ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-zinc-50'}`}>
                    {displayTitle}
                  </span>
                  
                  {/* Stats - Fade out on completion */}
                  <motion.div 
                    animate={{ opacity: isCompleting ? 0 : 1, height: isCompleting ? 0 : 'auto' }}
                    className="flex items-center gap-3 text-[11px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-widest overflow-hidden"
                  >
                    <span className={item.todayCount > 0 ? "text-zinc-500 dark:text-zinc-400" : ""}>
                      Today {item.todayCount}
                    </span>
                    {item.type === 'progress' && (
                      <>
                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                        <span>{item.total} {item.unit}</span>
                      </>
                    )}
                  </motion.div>
                </div>
            </motion.div>
          </motion.div>

          {/* Right Group: Number / Checkmark */}
          <motion.div 
            className="flex flex-col items-end justify-center pl-6 h-full absolute right-7"
            animate={{ 
                right: isCompleting ? '50%' : '28px', // Move to center
                x: isCompleting ? '50%' : 0 
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
             <AnimatePresence mode="wait">
               {isCompleting ? (
                 <motion.div 
                   key="completed-check"
                   initial={{ scale: 0, rotate: -180 }}
                   animate={{ scale: 1, rotate: 0 }}
                   exit={{ scale: 0 }}
                   transition={{ type: "spring", stiffness: 300, damping: 20 }}
                   className="flex items-center justify-center"
                 >
                    {/* The Jewel: A glowing checkmark */}
                    <div className="p-2 rounded-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-lg shadow-white/20 dark:shadow-black/20">
                      <Check className="size-5" strokeWidth={4} />
                    </div>
                 </motion.div>
               ) : (
                 <motion.div 
                   key="progress-number"
                   className="flex items-baseline gap-1.5"
                   animate={{ 
                      x: hoverZone === 'right' ? -48 : 0,
                      opacity: hoverZone === 'right' ? 0.6 : 1 
                   }}
                   exit={{ opacity: 0, scale: 0.8 }}
                   transition={{ type: "spring", stiffness: 400, damping: 30 }}
                 >
                    <span className="text-4xl font-light tracking-tighter text-zinc-900 dark:text-zinc-50 font-sans tabular-nums">
                      {item.type === 'progress' 
                        ? Math.round((item.current / item.total) * 100)
                        : item.current
                      }
                    </span>
                    <span className="text-sm font-medium text-zinc-400 dark:text-zinc-600 mb-1.5">
                      {item.type === 'progress' ? '%' : item.unit}
                    </span>
                 </motion.div>
               )}
             </AnimatePresence>
          </motion.div>
        </div>

        {/* Interaction Layer - Invisible but responsive */}
        <div className="absolute inset-0 flex cursor-pointer">
          {/* Minus Zone - Left 40% */}
          <div 
            className="w-[40%] flex items-center justify-start pl-6 opacity-0 hover:opacity-100 transition-opacity duration-200"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(item.id, -step);
            }}
            onMouseEnter={() => setHoverZone('left')}
            onMouseLeave={() => setHoverZone(null)}
          >
            <motion.div
              initial={{ x: -20, opacity: 0, scale: 0.8 }}
              animate={hoverZone === 'left' ? { x: 0, opacity: 1, scale: 1 } : { x: -20, opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-zinc-400 dark:text-zinc-500"
            >
              <Minus className="size-10" strokeWidth={1.5} />
            </motion.div>
          </div>

          {/* Center Detail Zone - Middle 20% */}
          <div 
             className="flex-1"
             onClick={onClick}
          />
          
          {/* Plus Zone - Right 40% */}
          <div 
            className="w-[40%] flex items-center justify-end pr-6 opacity-0 hover:opacity-100 transition-opacity duration-200"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(item.id, step);
            }}
            onMouseEnter={() => setHoverZone('right')}
            onMouseLeave={() => setHoverZone(null)}
          >
            <motion.div
              initial={{ x: 20, opacity: 0, scale: 0.8 }}
              animate={hoverZone === 'right' ? { x: 0, opacity: 1, scale: 1 } : { x: 20, opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-zinc-900 dark:text-zinc-100"
            >
              <Plus className="size-10" strokeWidth={1.5} />
            </motion.div>
          </div>
        </div>

        {/* Drag Handle - Hidden on far left edge */}
        <div 
            {...attributes} 
            {...listeners}
            className="absolute left-0 top-0 bottom-0 w-6 cursor-grab active:cursor-grabbing z-20"
        />

      </motion.div>
    </div>
  );
}



