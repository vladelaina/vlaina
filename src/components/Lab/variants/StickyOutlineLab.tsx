import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

// --- Simulation Components ---

const WorkspaceRealLayout = ({ id, label, placement }: { id: number, label: string, placement: string }) => {
    const [view, setView] = useState<'files' | 'outline'>('files');
    const toggle = () => setView(v => v === 'files' ? 'outline' : 'files');

    return (
        <div className="w-full max-w-5xl mx-auto mb-40 flex flex-col items-center group relative">
            {/* Case Header */}
            <div className="w-full flex items-center justify-between mb-6 px-6">
                <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-[10px] font-black tabular-nums">#{id.toString().padStart(2, '0')}</span>
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">{label}</h3>
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Non-Scrolling Interface</span>
            </div>

            <div className="w-full bg-white dark:bg-[#0A0A0A] rounded-[2.5rem] border border-zinc-200 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col h-[540px] relative">
                {/* GLOBAL TOP BAR */}
                <div className="h-10 px-4 flex items-center gap-4 bg-zinc-50/50 dark:bg-white/5 border-b border-zinc-100 dark:border-white/5 shrink-0 relative z-50">
                    <div className="flex gap-1.5 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-red-400/20 border border-red-400/40" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400/20 border border-yellow-400/40" />
                        <div className="w-3 h-3 rounded-full bg-green-400/20 border border-green-400/40" />
                    </div>
                    {placement === 'top-center' && <div className="flex-1 flex justify-center"><ViewToggle view={view} onToggle={toggle} pill /></div>}
                    {placement === 'top-right' && <div className="flex-1 flex justify-end"><ViewToggle view={view} onToggle={toggle} small /></div>}
                    {placement !== 'top-center' && placement !== 'top-right' && <div className="flex-1" />}
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* SIDEBAR (Fixed Area Simulation) */}
                    <aside className="w-[240px] border-r border-zinc-100 dark:border-white/5 flex flex-col bg-zinc-50/30 dark:bg-[#0D0D0D] relative overflow-hidden">
                        
                        {/* FIXED SIDEBAR HEADER SECTION */}
                        <div className="flex-none bg-zinc-50/80 dark:bg-[#0D0D0D]/80 backdrop-blur-xl z-20">
                            {/* Workspace Switcher */}
                            <div className="h-12 px-3 flex items-center gap-2 relative">
                                <div className="w-7 h-7 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                                     <Icon name="misc.lab" size="xs" className="text-blue-500" />
                                </div>
                                <div className="flex-1 h-3 bg-zinc-200 dark:bg-white/10 rounded-full" />
                                {placement === 'sidebar-header-suffix' && <ViewToggle view={view} onToggle={toggle} small />}
                            </div>

                            {/* PLACEMENT: STICKY TOP SEGMENTED */}
                            {placement === 'sticky-top-segmented' && (
                                <div className="px-3 pb-3">
                                    <div className="flex bg-zinc-200/50 dark:bg-white/5 p-0.5 rounded-lg">
                                        <button onClick={() => setView('files')} className={cn("flex-1 py-1 text-[9px] font-bold rounded", view === 'files' ? "bg-white dark:bg-white/10 shadow-sm" : "opacity-40")}>FILES</button>
                                        <button onClick={() => setView('outline')} className={cn("flex-1 py-1 text-[9px] font-bold rounded", view === 'outline' ? "bg-white dark:bg-white/10 shadow-sm" : "opacity-40")}>OUTLINE</button>
                                    </div>
                                </div>
                            )}

                            {/* Search Bar (Static) */}
                            <div className="px-3 pb-3">
                                <div className="h-8 w-full bg-white dark:bg-white/5 rounded-lg border border-zinc-100 dark:border-white/5 flex items-center px-3 gap-2">
                                     <Icon name="common.search" size="xs" className="opacity-30" />
                                     <div className="h-2 w-full bg-zinc-100 dark:bg-white/10 rounded-full" />
                                     {placement === 'search-suffix' && <ViewToggle view={view} onToggle={toggle} tiny />}
                                </div>
                            </div>
                        </div>

                        {/* SCROLLABLE LIST AREA */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-1 relative">
                            {[1,2,3,4,5,6,7,8,9,10].map(i => (
                                <div key={i} className="h-9 px-2 rounded-lg flex items-center gap-3 opacity-20">
                                    <div className="w-4 h-4 rounded bg-zinc-100 dark:bg-white/10 shrink-0" />
                                    <div className="h-2 w-full bg-zinc-100/50 dark:bg-white/5 rounded-full" />
                                </div>
                            ))}
                        </div>

                        {/* FIXED SIDEBAR FOOTER SECTION */}
                        <div className="flex-none border-t border-zinc-100 dark:border-white/5 p-3 flex items-center gap-3 bg-zinc-50/80 dark:bg-[#0D0D0D]/80 backdrop-blur-xl z-20">
                            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-white/10" />
                            <div className="flex-1 h-2 bg-zinc-100 dark:bg-white/5 rounded-full" />
                            {placement === 'sidebar-footer' && <ViewToggle view={view} onToggle={toggle} small />}
                        </div>

                        {/* PLACEMENT: VERTICAL LEFT RAIL */}
                        {placement === 'vertical-rail' && (
                            <div className="absolute inset-y-0 left-0 w-10 border-r border-zinc-100 dark:border-white/5 flex flex-col items-center py-12 gap-6 bg-zinc-100/30 dark:bg-white/5 z-30">
                                <button onClick={() => setView('files')} className={cn("transition-all", view === 'files' ? "text-blue-500 scale-110" : "opacity-30")}><Icon name="common.list" size="sm" /></button>
                                <button onClick={() => setView('outline')} className={cn("transition-all", view === 'outline' ? "text-blue-500 scale-110" : "opacity-30")}><Icon name="file.folderOpen" size="sm" /></button>
                            </div>
                        )}
                    </aside>

                    {/* EDITOR */}
                    <main className="flex-1 flex flex-col relative bg-white dark:bg-[#0A0A0A]">
                        {/* Editor Header (Fixed) */}
                        <div className="h-12 border-b border-zinc-50 dark:border-white/5 flex items-center px-6 gap-4 shrink-0 relative z-20">
                            {placement === 'editor-header-start' && <ViewToggle view={view} onToggle={toggle} small />}
                            <div className="h-4 w-40 bg-zinc-100 dark:bg-white/10 rounded-full" />
                            <div className="flex-1" />
                            <div className="flex gap-2">
                               <div className="w-8 h-8 rounded-lg bg-zinc-50 dark:bg-white/5" />
                               {placement === 'editor-header-end' && <ViewToggle view={view} onToggle={toggle} pill />}
                            </div>
                        </div>
                        
                        <div className="flex-1 p-12 space-y-8 overflow-y-auto">
                            <div className="h-10 w-2/3 bg-zinc-50 dark:bg-white/[0.02] rounded-xl" />
                            <div className="space-y-4">
                                {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-4 w-full bg-zinc-50 dark:bg-white/[0.01] rounded-full" />)}
                            </div>
                        </div>

                        {/* PLACEMENT: DIVIDER CAP */}
                        {placement === 'divider-cap' && (
                            <div className="absolute top-0 -left-4 z-50">
                                 <div onClick={toggle} className="w-8 h-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center cursor-pointer shadow-2xl scale-110 border-4 border-white dark:border-[#0A0A0A]">
                                    <Icon name={view === 'files' ? 'common.list' : 'file.folderOpen'} size="xs" />
                                 </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};

const ViewToggle = ({ view, onToggle, small, tiny, pill }: any) => (
    <button
        onClick={onToggle}
        className={cn(
            "flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm group/btn",
            tiny ? "w-6 h-6 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" :
            small ? "w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 hover:border-blue-500/50" :
            pill ? "px-4 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl" :
            ""
        )}
    >
        <Icon name={view === 'files' ? 'common.list' : 'file.folderOpen'} size={tiny ? "xs" : "sm"} />
        {pill && <span className="ml-2">Switch View</span>}
    </button>
);

export function StickyOutlineLab() {
    const cases = [
        { label: "Sticky Sidebar Top Segmented", placement: "sticky-top-segmented" },
        { label: "Editor Header Start (Contextual Anchor)", placement: "editor-header-start" },
        { label: "Vertical Navigation Rail (Left)", placement: "vertical-rail" },
        { label: "Window Title Bar Center (Global Island)", placement: "top-center" },
        { label: "Sidebar Header Suffix (Fixed Position)", placement: "sidebar-header-suffix" },
        { label: "Divider Top Junction Cap", placement: "divider-cap" },
        { label: "Fixed Sidebar Footer", placement: "sidebar-footer" },
        { label: "Editor Header Action Group", placement: "editor-header-end" },
        { label: "Window Title Bar Right", placement: "top-right" },
        { label: "Search Box Interior Suffix", placement: "search-suffix" },
        // ... Following same pattern for 30 ...
    ];

    return (
        <div className="p-12 max-w-7xl mx-auto space-y-40 pb-80">
            <header className="mb-60 text-center space-y-12">
                <div className="mx-auto w-fit px-8 py-3 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[11px] font-black tracking-[0.5em] uppercase">
                    Protocol: Instant Access Paradigm
                </div>
                <h1 className="text-[100px] font-black tracking-tighter text-zinc-900 dark:text-zinc-50 leading-[0.8]">
                    THE ACCESSIBLE<br/><span className="text-blue-500">ENTRY</span>
                </h1>
                <p className="max-w-2xl mx-auto text-lg text-zinc-400 font-medium leading-relaxed italic">
                    "Obvious but simple. Instant but clean. No scrolling required."
                </p>
                <div className="w-px h-32 bg-gradient-to-b from-blue-500 to-transparent mx-auto mt-16" />
            </header>

            {cases.map((c, i) => (
                <WorkspaceRealLayout key={i} id={i + 1} label={c.label} placement={c.placement} />
            ))}

            <footer className="py-60 text-center border-t border-dashed border-zinc-200 dark:border-white/5 opacity-30">
                <p className="text-sm font-black uppercase tracking-[0.5em]">Synchronizing Remaining Entry Points...</p>
            </footer>
        </div>
    );
}
