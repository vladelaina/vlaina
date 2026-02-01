import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  motion, 
  useSpring, 
  useMotionValue, 
  useTransform, 
  useVelocity
} from 'framer-motion';
import { MdAdd, MdRemove, MdExpandLess, MdExpandMore } from 'react-icons/md';

interface KineticActionProps {
  icon: typeof MdAdd | typeof MdRemove;
  step: number;
  direction: 'left' | 'right';
  onTrigger: () => void;
  onCommit: (delta: number) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  isActive: boolean;
  itemType?: 'progress' | 'counter';
  total?: number;
  current?: number; 
}

export function KineticAction({ 
  icon: Icon, 
  step, 
  direction, 
  onTrigger, 
  onCommit,
  onHoverStart,
  onHoverEnd,
  isActive,
  itemType = 'counter',
  total = 0,
  current = 0
}: KineticActionProps) {
  const [mode, setMode] = useState<'idle' | 'charging'>('idle');
  const [accumulatedValue, setAccumulatedValue] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  
  const originRef = useRef<{ x: number, y: number } | null>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const springConfig = { stiffness: 400, damping: 28, mass: 0.5 };
  const orbX = useSpring(mouseX, springConfig);
  const orbY = useSpring(mouseY, springConfig);

  const velocityY = useVelocity(orbY);
  const scale = useTransform(velocityY, [-1000, 1000], [0.9, 0.9]); 

  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const valueRef = useRef(0);
  const lastTimeRef = useRef(0);
  const isChargingRef = useRef(false);

  const callbacksRef = useRef({ onTrigger, onCommit, step });
  useEffect(() => {
    callbacksRef.current = { onTrigger, onCommit, step };
  }, [onTrigger, onCommit, step]);

  const LONG_PRESS_DELAY = 300;

  const triggerHaptic = (strength: number = 1) => {
    if (navigator.vibrate) navigator.vibrate(strength);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    
    (e.target as Element).setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    originRef.current = { x: centerX, y: centerY };
    
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
    orbX.set(e.clientX);
    orbY.set(e.clientY);
    
    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    
    timerRef.current = setTimeout(() => {
        startCharging();
    }, LONG_PRESS_DELAY);
  };

  const startCharging = () => {
    setMode('charging');
    isChargingRef.current = true;
    document.body.style.cursor = 'ns-resize';
    
    valueRef.current = 0;
    setAccumulatedValue(0);
    setSpeedMultiplier(1);
    
    triggerHaptic(15);
    startAccumulationLoop();
  };

  const handleGlobalPointerMove = useCallback((e: PointerEvent) => {
    if (e.buttons === 0 && (mode === 'charging' || timerRef.current)) {
        handleGlobalPointerUp();
        return;
    }

    mouseX.set(e.clientX);
    mouseY.set(e.clientY);

    if (isChargingRef.current && originRef.current) {
        const dy = originRef.current.y - e.clientY;
        
        let mult = 1;
        if (dy > 0) {
            mult = 1 + (dy / 20);
        } else {
            mult = Math.max(0.1, 1 + (dy / 100));
        }
        setSpeedMultiplier(mult);
    }
  }, [mouseX, mouseY]);

  const startAccumulationLoop = () => {
    lastTimeRef.current = performance.now();
    let lastInteger = 0;

    const loop = (time: number) => {
      const dt = Math.min(time - lastTimeRef.current, 64);
      lastTimeRef.current = time;

      let adaptiveBaseSpeed = 5;

      if (itemType === 'progress' && total > 0) {
          const cruiseSpeed = total * 0.05;
          adaptiveBaseSpeed = Math.max(5, cruiseSpeed);
      } else {
          if (valueRef.current > 100) adaptiveBaseSpeed = 50;
          else if (valueRef.current > 20) adaptiveBaseSpeed = 15;
      }
      
      const currentY = mouseY.get();
      const originY = originRef.current?.y || 0;
      const dy = originY - currentY;
      
      let mult = 1;
      
      if (dy > 0) {
          mult = 1 + Math.pow(dy / 25, 1.5);
      } else {
          mult = Math.max(0.1, 1 + (dy / 100));
      }

      const addition = adaptiveBaseSpeed * mult * (dt / 1000);
      
      let newValue = valueRef.current + addition;
      
      if (itemType === 'progress' && direction === 'right' && total > 0) {
          const maxAddableSteps = Math.max(0, (total - current) / step);
          if (newValue > maxAddableSteps) {
             newValue = maxAddableSteps;
             if (newValue !== valueRef.current) triggerHaptic(20);
          }
      }
      
      if (direction === 'left') {
          const maxRemovableSteps = Math.max(0, current / step);
          if (newValue > maxRemovableSteps) {
              newValue = maxRemovableSteps;
              if (newValue !== valueRef.current) triggerHaptic(20);
          }
      }

      valueRef.current = newValue;
      
      const currentInt = Math.floor(valueRef.current);
      setAccumulatedValue(currentInt);
      
      if (currentInt !== lastInteger) {
         const intensity = mult > 10 ? 15 : (mult > 4 ? 8 : 2);
         triggerHaptic(intensity);
         lastInteger = currentInt;
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const handleGlobalPointerUp = useCallback(() => {
    if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
    }
    
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    window.removeEventListener('pointermove', handleGlobalPointerMove);
    window.removeEventListener('pointerup', handleGlobalPointerUp);
    window.removeEventListener('pointercancel', handleGlobalPointerUp);
    document.body.style.cursor = '';

    if (isChargingRef.current) {
        const finalVal = Math.floor(valueRef.current);
        if (finalVal > 0) {
            callbacksRef.current.onCommit(finalVal * callbacksRef.current.step);
        }
    } else {
        if (!isChargingRef.current) {
             callbacksRef.current.onTrigger();
        }
    }

    setMode('idle');
    isChargingRef.current = false;
    originRef.current = null;
    setAccumulatedValue(0);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      document.body.style.cursor = '';
    };
  }, [handleGlobalPointerMove, handleGlobalPointerUp]);

  const ElasticLine = () => {
    if (!originRef.current || mode !== 'charging') return null;
    const x1 = originRef.current.x;
    const y1 = originRef.current.y;
    return (
       <svg className="fixed inset-0 pointer-events-none z-[9998] overflow-visible">
         <motion.line
           x1={x1}
           y1={y1}
           x2={orbX}
           y2={orbY}
           stroke="currentColor"
           strokeWidth="1.5"
           className="text-zinc-400 dark:text-zinc-500 opacity-40"
           strokeDasharray="2 4"
         />
       </svg>
    );
  };

  return (
    <>
      <div 
        className={`
          absolute inset-y-0 ${direction === 'left' ? 'left-0' : 'right-0'} 
          w-[30%] z-30 cursor-pointer active:cursor-grab flex items-center
          ${direction === 'left' ? 'justify-start pl-8' : 'justify-end pr-8'}
          outline-none select-none
        `}
        onPointerDown={handlePointerDown}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
      >
        <motion.div
          initial={{ x: direction === 'left' ? -20 : 20, opacity: 0, scale: 0.8 }}
          animate={
            isActive && mode === 'idle'
             ? { x: 0, opacity: 1, scale: 1 } 
             : { x: direction === 'left' ? -20 : 20, opacity: 0, scale: 0.8 }
          }
          transition={{ type: "spring", stiffness: 850, damping: 35, mass: 0.5 }}
          className="text-zinc-300 dark:text-zinc-600 pointer-events-none"
        >
           <Icon className="size-8" />
        </motion.div>
      </div>

      {mode === 'charging' && createPortal(
        <div className="fixed inset-0 z-[9999] font-sans text-zinc-900 dark:text-zinc-100 pointer-events-auto" onPointerUp={handleGlobalPointerUp}>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-zinc-100/50 dark:bg-black/50 backdrop-blur-sm pointer-events-none"
            />

            <ElasticLine />

            <motion.div
                style={{ x: orbX, y: orbY, scale }}
                className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 will-change-transform flex items-center justify-center pointer-events-none"
            >
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="relative flex flex-col items-center gap-6"
                >
                    <div className="
                        flex items-center justify-center gap-4
                        h-16 px-6
                        bg-white dark:bg-zinc-900 
                        rounded-2xl
                        border border-zinc-200 dark:border-zinc-700
                        shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)]
                    ">
                        <div className="flex flex-col items-center justify-center w-8 gap-0.5 opacity-80">
                             <MdExpandLess className={`size-[18px] ${speedMultiplier > 2 ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-300 dark:text-zinc-700'}`} />
                             <div className="h-5 w-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden relative">
                                <motion.div 
                                    className="absolute bottom-0 inset-x-0 bg-zinc-900 dark:bg-zinc-100"
                                    style={{ height: `${Math.min(100, (speedMultiplier - 0.5) * 20)}%` }}
                                />
                             </div>
                             <MdExpandMore className={`size-[18px] ${speedMultiplier < 0.8 ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-300 dark:text-zinc-700'}`} />
                        </div>

                        <div className="w-px h-8 bg-zinc-100 dark:bg-zinc-800" />
                        
                        <div className="flex flex-col items-start min-w-[80px]">
                             <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                                {direction === 'left' ? 'Removing' : 'Adding'}
                             </span>
                             <div className="flex items-baseline gap-2">
                                {/* The Delta */}
                                <span className="text-3xl font-bold tabular-nums leading-none text-zinc-900 dark:text-zinc-100">
                                    {accumulatedValue * step}
                                </span>
                                
                                {/* The Projected Result */}
                                <span className="text-sm font-bold text-zinc-400 dark:text-zinc-600">
                                    {itemType === 'progress' && total > 0 ? (
                                        `→ ${Math.round((Math.max(0, Math.min(total, current + (direction === 'left' ? -accumulatedValue * step : accumulatedValue * step))) / total) * 100)}%`
                                    ) : (
                                        `→ ${Math.max(0, current + (direction === 'left' ? -accumulatedValue * step : accumulatedValue * step))}`
                                    )}
                                </span>
                             </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
            
            {/* Helper Text (Bottom) */}
            <div className="fixed bottom-10 inset-x-0 text-center">
                 <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-widest opacity-60">
                    Drag Up to Accelerate
                 </p>
            </div>
        </div>,
        document.body
      )}
    </>
  );
}