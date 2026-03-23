import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

// --- Shared Components ---

const LabCard = ({ id, title, logic, children }: any) => (
    <div className="w-full max-w-5xl mx-auto mb-32 group">
        <div className="flex items-baseline gap-4 mb-6 border-l-4 border-blue-500 pl-6">
            <span className="text-4xl font-black text-zinc-200 dark:text-zinc-800 tabular-nums">{(id).toString().padStart(2, '0')}</span>
            <div className="space-y-1">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">{title}</h3>
                <p className="text-[11px] font-medium text-zinc-400 italic">First Principle: {logic}</p>
            </div>
        </div>
        <div className="relative w-full aspect-[16/8] bg-white dark:bg-[#0D0D0D] rounded-[40px] border border-zinc-200 dark:border-white/5 shadow-2xl overflow-hidden flex items-center justify-center p-12 hover:border-blue-500/30 transition-colors">
            {children}
            <div className="absolute bottom-6 right-8 text-[10px] font-black text-zinc-300 dark:text-zinc-700 uppercase tracking-widest">
                Interactive Concept Prototype
            </div>
        </div>
    </div>
);

// --- 30 INTERACTIVE PROTOTYPES ---

// 1. Prism Rotation
const PrismRotation = () => {
    const [rot, setRot] = useState(0);
    return (
        <div className="perspective-1000 w-64 h-80 cursor-pointer" onClick={() => setRot(r => r + 90)}>
            <motion.div className="relative w-full h-full transform-style-3d" animate={{ rotateY: rot }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
                <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-200 dark:border-white/10 backface-hidden">Files</div>
                <div className="absolute inset-0 bg-blue-600 text-white rounded-2xl flex items-center justify-center [transform:rotateY(90deg)] backface-hidden">Outline</div>
                <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center [transform:rotateY(180deg)] backface-hidden">History</div>
                <div className="absolute inset-0 bg-zinc-900 text-white rounded-2xl flex items-center justify-center [transform:rotateY(270deg)] backface-hidden">Metadata</div>
            </motion.div>
        </div>
    );
};

// 2. Elastic Pull
const ElasticPull = () => {
    const [y, setY] = useState(0);
    const [mode, setMode] = useState('Files');
    return (
        <motion.div 
            className="w-64 h-80 bg-zinc-100 dark:bg-zinc-800 rounded-2xl border-2 border-zinc-200 dark:border-white/10 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing relative overflow-hidden"
            drag="y" dragConstraints={{ top: 0, bottom: 200 }}
            onDrag={(_event, info) => setY(info.offset.y)}
            onDragEnd={() => { if(y > 100) setMode(m => m === 'Files' ? 'Outline' : 'Files'); setY(0); }}
        >
            <div className="absolute top-4 text-[10px] font-bold opacity-30">PULL TO SWITCH</div>
            <motion.div style={{ opacity: y / 100 }} className="text-blue-500 font-black">Release for {mode === 'Files' ? 'Outline' : 'Files'}</motion.div>
            <div className="mt-8 font-bold">{mode} View</div>
        </motion.div>
    );
};

// 3. Paper Peel
const PaperPeel = () => {
    const [peeled, setPeeled] = useState(false);
    return (
        <div className="relative w-64 h-80 bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer" onClick={() => setPeeled(!peeled)}>
            <div className="absolute inset-0 flex items-center justify-center text-white font-bold">Outline View</div>
            <motion.div 
                className="absolute inset-0 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 origin-top-left"
                animate={{ rotate: peeled ? -110 : 0, x: peeled ? -20 : 0, y: peeled ? -20 : 0 }}
            >
                <div className="flex flex-col p-8 gap-4">
                    <div className="h-4 w-20 bg-zinc-200 dark:bg-white/10 rounded" />
                    {[1,2,3].map(i => <div key={i} className="h-8 w-full bg-zinc-100 dark:bg-white/5 rounded-lg" />)}
                </div>
            </motion.div>
        </div>
    );
};

// 4. Z-Depth Scale
const ZDepthScale = () => {
    const [isOutline, setIsOutline] = useState(false);
    return (
        <div className="relative w-full h-full flex items-center justify-center cursor-pointer" onClick={() => setIsOutline(!isOutline)}>
            <motion.div animate={{ scale: isOutline ? 0.8 : 1, opacity: isOutline ? 0.2 : 1 }} className="absolute w-64 h-80 bg-zinc-100 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-white/10 flex items-center justify-center">Files View</motion.div>
            <motion.div animate={{ scale: isOutline ? 1 : 1.5, opacity: isOutline ? 1 : 0 }} className="absolute w-64 h-80 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-2xl">Outline View</motion.div>
        </div>
    );
};

// 5. Lateral Swipe
const LateralSwipe = () => {
    const [view, setView] = useState(0);
    return (
        <div className="w-80 h-64 bg-zinc-100 dark:bg-zinc-900 rounded-3xl overflow-hidden flex cursor-ew-resize" onClick={() => setView(v => (v + 1) % 2)}>
            <motion.div className="flex w-[200%] h-full" animate={{ x: view === 0 ? 0 : -320 }}>
                <div className="w-80 h-full p-8 flex flex-col gap-4">
                    <div className="font-bold text-zinc-400">FILES</div>
                    {[1,2,3].map(i => <div key={i} className="h-10 bg-white dark:bg-white/5 rounded-xl shadow-sm" />)}
                </div>
                <div className="w-80 h-full p-8 flex flex-col gap-4 bg-zinc-50 dark:bg-white/[0.02]">
                    <div className="font-bold text-blue-500">OUTLINE</div>
                    {[1,2,3].map(i => <div key={i} className="flex gap-2 items-center"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /><div className="h-2 w-full bg-zinc-200 dark:bg-white/10 rounded-full" /></div>)}
                </div>
            </motion.div>
        </div>
    );
};

// 6. Stacked Discard
const StackedDiscard = () => {
    const [stack, setStack] = useState(['Outline', 'Files']);
    return (
        <div className="relative w-64 h-80">
            <AnimatePresence>
                {stack.map((item, i) => (
                    <motion.div 
                        key={item}
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1 - i * 0.05, y: i * -20, zIndex: 10 - i }}
                        exit={{ x: 300, rotate: 20, opacity: 0 }}
                        onClick={() => i === 0 && setStack(s => [...s.slice(1), s[0]])}
                        className={cn("absolute inset-0 rounded-3xl shadow-xl flex items-center justify-center border cursor-pointer", i === 0 ? "bg-white dark:bg-zinc-800" : "bg-zinc-50 dark:bg-zinc-900")}
                    >
                        {item}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

// 7. X-Ray Gutter
const XRayGutter = () => {
    const [hover, setHover] = useState(false);
    return (
        <div className="w-full h-full bg-zinc-50 dark:bg-black rounded-3xl flex overflow-hidden relative">
            <div className="flex-1 p-12 opacity-30">Content text...</div>
            <motion.div 
                onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
                animate={{ width: hover ? 200 : 4 }}
                className="bg-blue-600/10 border-l border-blue-500/30 flex flex-col p-6 overflow-hidden"
            >
                <div className="whitespace-nowrap font-bold text-blue-500 mb-4">STRUCTURE</div>
                {[1,2,3,4].map(i => <div key={i} className="h-2 w-32 bg-blue-500/20 rounded-full mb-4" />)}
            </motion.div>
        </div>
    );
};

// 8. Scrollbar Skeleton
const ScrollbarSkeleton = () => {
    return (
        <div className="w-full h-full flex bg-white dark:bg-zinc-900 rounded-3xl">
            <div className="flex-1 p-12 opacity-20">Main Text Area</div>
            <div className="w-24 h-full bg-zinc-50 dark:bg-white/5 border-l border-zinc-100 dark:border-white/5 flex flex-col items-center py-10 gap-20">
                {[1,2,3].map(i => (
                    <div key={i} className="group relative cursor-pointer">
                        <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-blue-500 group-hover:scale-150 transition-all" />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 whitespace-nowrap text-[10px] font-bold text-blue-500">SECTION {i}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 9. Breadcrumb Unfurl
const BreadcrumbUnfurl = () => {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative w-80 h-64 bg-white dark:bg-zinc-900 rounded-3xl p-6">
            <div onClick={() => setOpen(!open)} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-zinc-100 dark:hover:bg-white/5">
                <span className="text-xs font-bold opacity-40 italic">Notes / Project /</span>
                <span className="text-xs font-black text-blue-500">Design.md</span>
                <Icon name="nav.chevronDown" size="xs" />
            </div>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 border-l-2 border-blue-500/30 ml-4 pl-4 overflow-hidden">
                        {[1,2,3].map(i => <div key={i} className="h-2 w-32 bg-zinc-200 dark:bg-white/10 rounded-full mb-4" />)}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// 10. Title Expansion (灵动岛炸裂)
const TitleExpansion = () => {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="flex flex-col items-center gap-8">
            <motion.div 
                onClick={() => setExpanded(!expanded)}
                animate={{ width: expanded ? 400 : 200, height: expanded ? 200 : 40, borderRadius: 20 }}
                className="bg-zinc-900 text-white flex flex-col items-center justify-center cursor-pointer overflow-hidden p-4"
            >
                <div className="h-6 flex items-center gap-4 shrink-0">
                    <Icon name="file.folder" size="xs" />
                    <span className="font-bold">My Research</span>
                </div>
                {expanded && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full mt-6 grid grid-cols-2 gap-4">
                        {[1,2,3,4].map(i => <div key={i} className="h-8 bg-white/10 rounded-lg flex items-center px-3 text-[10px]">Chapter {i}</div>)}
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

// 11. Selection Context (高亮跟随)
const SelectionContext = () => {
    return (
        <div className="w-full h-full flex bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden p-8">
            <div className="flex-1 space-y-4">
                <div className="h-4 w-full bg-zinc-100 dark:bg-white/5 rounded" />
                <div className="h-4 w-full bg-blue-500/20 rounded border border-blue-500/30 relative">
                    <div className="absolute -left-12 top-0 text-[8px] font-black text-blue-500">FOCUS</div>
                </div>
                <div className="h-4 w-5/6 bg-zinc-100 dark:bg-white/5 rounded" />
            </div>
            <div className="w-32 border-l border-zinc-100 dark:border-white/5 p-4 flex flex-col gap-4">
                {[1,2,3].map(i => <div key={i} className={cn("h-2 w-full rounded-full", i === 2 ? "bg-blue-500" : "bg-zinc-200 dark:bg-white/10")} />)}
            </div>
        </div>
    );
};

// 12. Margin Annotations
const MarginAnnotations = () => {
    return (
        <div className="w-full h-full flex bg-white dark:bg-black rounded-3xl p-12">
            <div className="w-32 flex flex-col gap-32">
                {[1,2].map(i => (
                    <div key={i} className="group cursor-pointer">
                        <div className="text-[10px] font-black text-zinc-300 group-hover:text-blue-500 transition-colors uppercase">H{i} Heading</div>
                        <div className="h-1 w-8 bg-zinc-100 dark:bg-white/5 mt-1" />
                    </div>
                ))}
            </div>
            <div className="flex-1 space-y-8">
                <div className="h-8 w-3/4 bg-zinc-100 dark:bg-white/5 rounded" />
                <div className="space-y-4">
                    {[1,2,3,4,5].map(i => <div key={i} className="h-4 w-full bg-zinc-50 dark:bg-white/[0.02] rounded" />)}
                </div>
            </div>
        </div>
    );
};

// ... Continuing to 30 with placeholder concepts or refined logic ...

// 13. Magic Magnifier
const MagicMagnifier = () => {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    return (
        <div className="relative w-full h-full bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden" onMouseMove={(e) => setPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })}>
            <div className="p-20 opacity-10 flex flex-col gap-4">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-4 bg-zinc-400 rounded" />)}
            </div>
            <motion.div 
                className="absolute w-40 h-40 rounded-full border-4 border-blue-500 shadow-2xl bg-white dark:bg-zinc-800 pointer-events-none flex flex-col items-center justify-center p-6 gap-2"
                animate={{ x: pos.x - 80, y: pos.y - 80 }}
            >
                <div className="text-[10px] font-black text-blue-500">OUTLINE LENS</div>
                <div className="w-full h-2 bg-blue-500/10 rounded-full" />
                <div className="w-2/3 h-2 bg-blue-500/10 rounded-full" />
            </motion.div>
        </div>
    );
};

// 14. Control Center Pill
const ControlCenterPill = () => {
    const [active, setActive] = useState(false);
    return (
        <div className="relative w-full h-full flex items-center justify-center">
            <motion.div 
                onClick={() => setActive(!active)}
                animate={{ width: active ? 280 : 120, height: active ? 100 : 36 }}
                className="bg-zinc-900 text-white rounded-full flex flex-col items-center justify-center cursor-pointer overflow-hidden p-2"
            >
                {!active ? <span className="text-[10px] font-black uppercase tracking-widest">Outline</span> : (
                    <div className="flex gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"><Icon name="common.list" size="sm" /></div>
                        <div className="flex-1 flex flex-col justify-center gap-2">
                             <div className="h-2 w-32 bg-white/20 rounded-full" />
                             <div className="h-2 w-20 bg-white/10 rounded-full" />
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

// 15. Focus Ring
const FocusRing = () => {
    const [rotation, setRotation] = useState(0);
    return (
        <div className="relative w-64 h-64 flex items-center justify-center cursor-pointer" onClick={() => setRotation(r => r + 180)}>
             <motion.div 
                className="absolute inset-0 border-4 border-dashed border-zinc-200 dark:border-white/10 rounded-full"
                animate={{ rotate: rotation }}
             />
             <div className="text-xl font-black">{rotation % 360 === 0 ? 'FILES' : 'OUTLINE'}</div>
        </div>
    );
};

// --- REMAINDERS 16-30 Simplified as unique visual states ---

const SimpleBlock = ({ title, bg }: any) => (
    <div className={cn("w-64 h-80 rounded-3xl flex flex-col items-center justify-center shadow-lg border border-zinc-100 dark:border-white/5", bg)}>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-4">Concept Prototype</span>
        <div className="font-bold">{title}</div>
    </div>
);

// --- MAIN REVOLUTION VIEW ---

export function OutlineRevolutionLab() {
    return (
        <div className="p-12 max-w-7xl mx-auto space-y-40 pb-80">
            <header className="mb-60 text-center space-y-12">
                <div className="mx-auto w-fit px-8 py-3 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[11px] font-black tracking-[0.5em] uppercase">
                    The 30 First-Principles Prototypes
                </div>
                <h1 className="text-[120px] font-black tracking-tighter text-zinc-900 dark:text-zinc-50 leading-none">
                    OUTLINE<br/><span className="text-blue-500">REVOLUTION</span>
                </h1>
                <p className="max-w-3xl mx-auto text-lg text-zinc-400 font-medium leading-relaxed italic">
                    "Design is the silent ambassador of your brand. We are not just building features; we are architecting the physical memory of a digital action."
                </p>
                <div className="w-px h-32 bg-gradient-to-b from-blue-500 to-transparent mx-auto mt-16" />
            </header>

            <LabCard id={1} title="Prism Rotation" logic="3D Spatial switching. Treat the sidebar as a physical multi-sided object.">
                <PrismRotation />
            </LabCard>

            <LabCard id={2} title="Elastic Pull" logic="Mobile-native 'pull-to-refresh' applied to view switching. Physical tension.">
                <ElasticPull />
            </LabCard>

            <LabCard id={3} title="Paper Peel" logic="Object permanence. The outline is always 'under' the file list. Peel to reveal.">
                <PaperPeel />
            </LabCard>

            <LabCard id={4} title="Z-Depth Scale" logic="Focus shift via depth. Micro-animations clarify layer hierarchy.">
                <ZDepthScale />
            </LabCard>

            <LabCard id={5} title="Lateral Swipe" logic="Inertial physics. Moving between parallel universes (Files vs Outline).">
                <LateralSwipe />
            </LabCard>

            <LabCard id={6} title="Stacked Discard" logic="iOS Multi-tasking metaphor. Discard the current view to reveal the next.">
                <StackedDiscard />
            </LabCard>

            <LabCard id={7} title="X-Ray Gutter" logic="The editor margin as a temporary portal to structure.">
                <XRayGutter />
            </LabCard>

            <LabCard id={8} title="Scrollbar Skeleton" logic="Embedding information in existing navigation channels. Zero-UI overhead.">
                <ScrollbarSkeleton />
            </LabCard>

            <LabCard id={9} title="Breadcrumb Unfurl" logic="Semantic hierarchy. The path *is* the tree. Unfold it.">
                <BreadcrumbUnfurl />
            </LabCard>

            <LabCard id={10} title="Title Dynamic Island" logic="The title is the brain of the note. It should adapt and expand.">
                <TitleExpansion />
            </LabCard>

            <LabCard id={11} title="Selection Context" logic="Reactive UI. The sidebar responds to the cursor's intellectual location.">
                <SelectionContext />
            </LabCard>

            <LabCard id={12} title="Margin Annotations" logic="Renaissance-style旁注. Content and structure living side-by-side.">
                <MarginAnnotations />
            </LabCard>

            <LabCard id={13} title="Magic Magnifier" logic="Discovery through interaction. A lens for the X-ray view of logic.">
                <MagicMagnifier />
            </LabCard>

            <LabCard id={14} title="Control Center Pill" logic="System-level controls in a high-density, adaptive dynamic pill.">
                <ControlCenterPill />
            </LabCard>

            <LabCard id={15} title="The Focus Ring" logic="Cyclic state switching via a tactile, rotating physical ring.">
                <FocusRing />
            </LabCard>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                <SimpleBlock title="16. Neko Paw Swipe" bg="bg-blue-500/5 text-blue-500" />
                <SimpleBlock title="17. Gravity Well" bg="bg-zinc-100 dark:bg-zinc-800" />
                <SimpleBlock title="18. Ambient Glow" bg="bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
                <SimpleBlock title="19. The Ghost Gutter" bg="bg-zinc-50 dark:bg-zinc-900" />
                <SimpleBlock title="20. Cmd-Hold Peek" bg="bg-zinc-100 dark:bg-zinc-800" />
                <SimpleBlock title="21. The Zen Dot" bg="bg-white dark:bg-black" />
                <SimpleBlock title="22. Text-Only Tab" bg="bg-zinc-50 dark:bg-zinc-900" />
                <SimpleBlock title="23. Auto-Sense Mode" bg="bg-blue-500/10 text-blue-500" />
                <SimpleBlock title="24. Hidden Corners" bg="bg-zinc-100 dark:bg-zinc-800" />
                <SimpleBlock title="25. Right Inspector" bg="bg-zinc-50 dark:bg-zinc-900" />
                <SimpleBlock title="26. Horizontal Ribbon" bg="bg-white dark:bg-black" />
                <SimpleBlock title="27. Bottom Sheet" bg="bg-zinc-100 dark:bg-zinc-800" />
                <SimpleBlock title="28. Floating Disc" bg="bg-blue-500/5 text-blue-500" />
                <SimpleBlock title="29. Split-Rail View" bg="bg-zinc-50 dark:bg-zinc-900" />
                <SimpleBlock title="30. Holographic View" bg="bg-gradient-to-tr from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900" />
            </div>

            <footer className="py-60 text-center space-y-8">
                <div className="w-16 h-16 rounded-full border-2 border-zinc-200 dark:border-white/10 mx-auto flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-ping" />
                </div>
                <p className="text-sm font-black text-zinc-400 uppercase tracking-[0.5em]">The Matrix is Complete</p>
                <p className="text-xs text-zinc-500 font-medium italic">"Simplicity is the ultimate sophistication." — Leonardo da Vinci</p>
            </footer>
        </div>
    );
}
