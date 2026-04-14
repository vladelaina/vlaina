import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  DRAG_HANDLE_CONCEPTS,
  type DragHandleConcept,
  type InteractionPhysics,
} from '../variants/tableHandleFirstPrinciples';

// --- Demo Data ---
const COLUMNS = [
  { id: 'task', label: 'Priority Task', width: '200px' },
  { id: 'status', label: 'Status', width: '120px' },
  { id: 'owner', label: 'Owner', width: '100px' },
];

const ROWS = [
  { id: '1', task: 'Redesign Interaction', status: 'In Progress', owner: 'Gemini' },
  { id: '2', task: 'First Principles Lab', status: 'Drafting', owner: 'User' },
  { id: '3', task: 'Aesthetic Audit', status: 'Queued', owner: 'vlaina' },
];

// --- Sub-components for Physics Effects ---

function PhysicsHandle({
  physics,
  isDragging,
  isHovered,
  index,
  onDragStart,
  onDragEnd,
}: {
  physics: InteractionPhysics;
  isDragging: boolean;
  isHovered: boolean;
  index: number;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring physics for Tension String
  const springConfig = { damping: 15, stiffness: 150 };
  const tx = useSpring(mouseX, springConfig);
  const ty = useSpring(mouseY, springConfig);

  useEffect(() => {
    if (isDragging) return;
    mouseX.set(0);
    mouseY.set(0);
  }, [isDragging, mouseX, mouseY]);

  const renderHandle = () => {
    switch (physics) {
      case 'grid-knot':
        return (
          <motion.div
            animate={{ scale: isHovered ? 1.5 : 1, opacity: isHovered ? 1 : 0.3 }}
            className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-primary"
          />
        );
      case 'border-rift':
        return (
          <motion.div
            animate={{ height: isHovered ? '40%' : '100%' }}
            className="absolute left-0 top-1/2 w-0.5 -translate-y-1/2 bg-primary/50"
          />
        );
      case 'negative-notch':
        return (
          <div className="absolute left-0 top-1/2 h-6 w-3 -translate-x-1.5 -translate-y-1/2 rounded-full bg-background border border-border" />
        );
      case 'tension-string':
        return (
          <motion.div
            style={{ x: tx, y: ty }}
            className="absolute left-0 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="h-full w-full rounded-full border-2 border-primary bg-background" />
            {isDragging && (
              <svg className="absolute overflow-visible pointer-events-none" style={{ left: 8, top: 8 }}>
                <motion.line
                  x1={0} y1={0}
                  x2={useTransform(tx, v => -v)}
                  y2={useTransform(ty, v => -v)}
                  stroke="currentColor"
                  className="text-primary/30"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              </svg>
            )}
          </motion.div>
        );
      case 'status-light':
        return (
          <motion.div
            animate={{
              backgroundColor: isDragging ? '#2563eb' : '#10b981',
              scale: isHovered ? 1.2 : 1,
            }}
            className="absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"
          />
        );
      case 'index-handle':
        return (
          <motion.span
            animate={{ color: isHovered ? '#2563eb' : '#94a3b8' }}
            className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold"
          >
            0{index + 1}
          </motion.span>
        );
      case 'chrono-tick':
        return (
          <div className="absolute left-0 inset-y-2 flex flex-col justify-between items-center w-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-px w-2 bg-border" />
            ))}
          </div>
        );
      case 'zen-ring':
        return (
          <motion.div
            animate={{ rotate: isDragging ? 180 : 0, scale: isHovered ? 1.1 : 1 }}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border border-primary/30 border-t-primary"
          />
        );
      // More cases can be added here for all 30 types
      default:
        return (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-20 group-hover:opacity-100 transition-opacity">
             <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted-foreground">
                <circle cx="4" cy="4" r="1" fill="currentColor" />
                <circle cx="8" cy="4" r="1" fill="currentColor" />
                <circle cx="4" cy="6" r="1" fill="currentColor" />
                <circle cx="8" cy="6" r="1" fill="currentColor" />
                <circle cx="4" cy="8" r="1" fill="currentColor" />
                <circle cx="8" cy="8" r="1" fill="currentColor" />
             </svg>
          </div>
        );
    }
  };

  return (
    <div
      className="absolute inset-y-0 left-0 w-8 cursor-grab active:cursor-grabbing group z-20"
      onPointerDown={onDragStart}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      onPointerLeave={() => {
        if (isDragging) onDragEnd();
      }}
      onPointerMove={(e) => {
        if (isDragging) {
          mouseX.set(e.movementX * 2);
          mouseY.set(e.movementY * 2);
        }
      }}
    >
      {renderHandle()}
    </div>
  );
}

export function FirstPrinciplesTableDrag() {
  const [activeConcept, setActiveConcept] = useState<DragHandleConcept>(DRAG_HANDLE_CONCEPTS[0]);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [draggingRow, setDraggingRow] = useState<string | null>(null);

  const physics = activeConcept.physics;

  return (
    <div className="flex h-full w-full flex-col bg-[#fafafa] p-8 font-sans selection:bg-primary/10">
      <header className="mb-12 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60"
        >
          First Principles Lab
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 text-4xl font-light tracking-tight text-neutral-900"
        >
          {activeConcept.name}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-lg font-light leading-relaxed text-neutral-500"
        >
          {activeConcept.philosophy}
        </motion.p>
      </header>

      <div className="flex flex-1 gap-12 overflow-hidden">
        {/* Concept Selector */}
        <aside className="w-64 overflow-y-auto pr-4 scrollbar-hide">
          <div className="space-y-8">
            {(['Grid', 'Physics', 'Minimalism', 'Spatial', 'Aesthetic'] as const).map((cat) => (
              <section key={cat}>
                <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400">{cat}</h3>
                <div className="flex flex-col gap-1">
                  {DRAG_HANDLE_CONCEPTS.filter(c => c.category === cat).map((concept) => (
                    <button
                      key={concept.id}
                      onClick={() => setActiveConcept(concept)}
                      className={cn(
                        "group relative flex items-center px-3 py-2 text-sm transition-all duration-300 rounded-lg",
                        activeConcept.id === concept.id
                          ? "bg-white text-primary shadow-sm"
                          : "text-neutral-500 hover:text-neutral-900 hover:bg-white/50"
                      )}
                    >
                      {activeConcept.id === concept.id && (
                        <motion.div
                          layoutId="active-pill"
                          className="absolute left-0 w-1 h-4 bg-primary rounded-full"
                        />
                      )}
                      <span className="ml-2">{concept.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </aside>

        {/* Live Preview Area */}
        <main className="flex-1 rounded-[32px] bg-white p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] border border-neutral-100 flex flex-col justify-center items-center overflow-hidden">
          <div className="w-full max-w-2xl">
            <div className="mb-6 flex items-center justify-between px-2">
              <div className="flex gap-2">
                 <div className="h-2 w-2 rounded-full bg-red-400/20" />
                 <div className="h-2 w-2 rounded-full bg-amber-400/20" />
                 <div className="h-2 w-2 rounded-full bg-emerald-400/20" />
              </div>
              <div className="text-[10px] font-mono text-neutral-300">TABLE_INTERACTION_V3</div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-neutral-100 bg-white">
               {/* Grid Header */}
               <div className="grid grid-cols-[200px_120px_1fr] bg-neutral-50/50 border-b border-neutral-100">
                  {COLUMNS.map(col => (
                    <div key={col.id} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      {col.label}
                    </div>
                  ))}
               </div>

               {/* Grid Rows */}
               <div className="relative">
                  {ROWS.map((row, idx) => (
                    <motion.div
                      key={row.id}
                      layout
                      onHoverStart={() => setHoveredRow(row.id)}
                      onHoverEnd={() => setHoveredRow(null)}
                      className={cn(
                        "group relative grid grid-cols-[200px_120px_1fr] border-b border-neutral-50 last:border-0 transition-colors",
                        draggingRow === row.id ? "z-50 bg-white shadow-2xl scale-[1.02]" : "hover:bg-neutral-50/30"
                      )}
                    >
                      <PhysicsHandle
                        physics={physics}
                        index={idx}
                        isDragging={draggingRow === row.id}
                        isHovered={hoveredRow === row.id}
                        onDragStart={() => setDraggingRow(row.id)}
                        onDragEnd={() => {
                          setDraggingRow((current) => current === row.id ? null : current);
                        }}
                      />
                      
                      <div className="px-6 py-5 text-sm font-medium text-neutral-900 ml-4">
                        {row.task}
                      </div>
                      <div className="px-6 py-5">
                         <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-medium text-neutral-600">
                           {row.status}
                         </span>
                      </div>
                      <div className="px-6 py-5 text-sm text-neutral-500">
                        {row.owner}
                      </div>

                      {/* Visual Effect: Floating Island */}
                      {physics === 'floating-island' && draggingRow === row.id && (
                         <motion.div
                           className="absolute inset-0 rounded-xl border border-primary/20 bg-primary/5 -z-10"
                           layoutId="island-bg"
                         />
                      )}
                    </motion.div>
                  ))}
               </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-[11px] text-neutral-400 italic">
                Grab the edge handle to reorder. Notice how the <span className="text-primary font-bold">{activeConcept.name}</span> affects the perception of weight and connection.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
