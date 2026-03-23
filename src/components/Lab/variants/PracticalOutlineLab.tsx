import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

// --- Simulation Components ---

/**
 * 这是一个极致仿真的 NekoTick 界面框架
 */
const NekoRealLayout = ({ id, label, placement }: { id: number, label: string, placement: string }) => {
    const [view, setView] = useState<'files' | 'outline'>('files');
    const toggle = () => setView(v => v === 'files' ? 'outline' : 'files');

    return (
        <div className="w-full max-w-5xl mx-auto mb-24 bg-white dark:bg-[#0A0A0A] rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col h-[520px]">
            {/* Window Top Bar (Apple Style) */}
            <div className="h-10 px-4 flex items-center gap-4 bg-zinc-50/50 dark:bg-white/5 border-b border-zinc-100 dark:border-white/5 shrink-0">
                <div className="flex gap-1.5 shrink-0">
                    <div className="w-3 h-3 rounded-full bg-red-400/20 border border-red-400/40" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400/20 border border-yellow-400/40" />
                    <div className="w-3 h-3 rounded-full bg-green-400/20 border border-green-400/40" />
                </div>
                
                {/* Placement: Top Bar Center */}
                {placement === 'top-center' && <div className="flex-1 flex justify-center"><ViewToggle view={view} onToggle={toggle} pill /></div>}
                {placement !== 'top-center' && <div className="flex-1" />}

                {/* Placement: Top Bar Right */}
                {placement === 'top-right' && <ViewToggle view={view} onToggle={toggle} small />}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* SIDEBAR */}
                <aside className="w-[240px] border-r border-zinc-100 dark:border-white/5 flex flex-col bg-zinc-50/30 dark:bg-[#0D0D0D] relative">
                    {/* Sidebar Header */}
                    <div className="h-12 px-3 flex items-center gap-2 border-b border-zinc-100/30 dark:border-white/5 relative">
                        <div className="w-7 h-7 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                             <Icon name="misc.lab" size="xs" className="text-blue-500" />
                        </div>
                        <div className="flex-1 h-3 bg-zinc-200 dark:bg-white/10 rounded-full" />
                        
                        {/* Placement: Sidebar Header Suffix */}
                        {placement === 'sidebar-header' && <ViewToggle view={view} onToggle={toggle} small />}
                    </div>

                    {/* Placement: Sidebar Top Tabs */}
                    {placement === 'sidebar-tabs' && (
                        <div className="px-3 pt-3 flex gap-1">
                            <button onClick={() => setView('files')} className={cn("flex-1 py-1 rounded-md text-[10px] font-bold", view === 'files' ? "bg-white dark:bg-white/10 shadow-sm" : "opacity-40")}>FILES</button>
                            <button onClick={() => setView('outline')} className={cn("flex-1 py-1 rounded-md text-[10px] font-bold", view === 'outline' ? "bg-white dark:bg-white/10 shadow-sm" : "opacity-40")}>OUTLINE</button>
                        </div>
                    )}

                    {/* Search Bar Area */}
                    <div className="p-3 space-y-3">
                        <div className="h-8 w-full bg-white dark:bg-white/5 rounded-lg border border-zinc-100 dark:border-white/5 flex items-center px-3 gap-2 relative">
                             <Icon name="common.search" size="xs" className="opacity-30" />
                             <div className="h-2 w-20 bg-zinc-100 dark:bg-white/10 rounded-full" />
                             
                             {/* Placement: Search Suffix */}
                             {placement === 'search-suffix' && <div className="absolute right-1"><ViewToggle view={view} onToggle={toggle} tiny /></div>}
                        </div>
                        
                        {/* Placement: Under Search Segmented */}
                        {placement === 'under-search' && <div className="flex bg-zinc-100/50 dark:bg-white/5 p-0.5 rounded-lg"><div className={cn("flex-1 py-1 text-[9px] font-bold text-center rounded", view === 'files' ? "bg-white dark:bg-white/10" : "opacity-40")}>Files</div><div className={cn("flex-1 py-1 text-[9px] font-bold text-center rounded", view === 'outline' ? "bg-white dark:bg-white/10" : "opacity-40")}>Outline</div></div>}
                    </div>

                    {/* Note List */}
                    <div className="flex-1 px-3 space-y-1 relative">
                        {/* Placement: List Top Smart Entry */}
                        {placement === 'list-smart-entry' && (
                            <div className="h-8 mb-2 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between px-1">
                                <span className="text-[10px] font-bold text-zinc-400">VIEW MODE</span>
                                <ViewToggle view={view} onToggle={toggle} tiny />
                            </div>
                        )}

                        {[1,2,3,4,5].map(i => (
                            <div key={i} className="h-9 px-2 rounded-lg flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                                <div className="w-4 h-4 rounded bg-zinc-100 dark:bg-white/10 shrink-0" />
                                <div className="h-2 w-full bg-zinc-100/50 dark:bg-white/5 rounded-full" />
                            </div>
                        ))}
                    </div>

                    {/* Sidebar Footer */}
                    <div className="h-14 border-t border-zinc-100 dark:border-white/5 p-3 flex items-center gap-3 relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-white/10" />
                        <div className="flex-1 h-2 bg-zinc-100 dark:bg-white/5 rounded-full" />
                        
                        {/* Placement: Sidebar Footer Action */}
                        {placement === 'sidebar-footer' && <ViewToggle view={view} onToggle={toggle} small />}
                    </div>
                </aside>

                {/* EDITOR */}
                <main className="flex-1 flex flex-col relative bg-white dark:bg-[#0A0A0A]">
                    <div className="h-12 border-b border-zinc-50 dark:border-white/5 flex items-center px-6 gap-4 relative shrink-0">
                        {/* Placement: Editor Header Start */}
                        {placement === 'editor-header-start' && <ViewToggle view={view} onToggle={toggle} small />}
                        
                        <div className="h-4 w-40 bg-zinc-100 dark:bg-white/10 rounded-full" />
                        <div className="flex-1" />
                        
                        {/* Placement: Editor Header End */}
                        {placement === 'editor-header-end' && <ViewToggle view={view} onToggle={toggle} pill />}
                    </div>
                    
                    <div className="p-12 space-y-8">
                        <div className="h-10 w-2/3 bg-zinc-50 dark:bg-white/[0.02] rounded-xl" />
                        <div className="space-y-4">
                            {[1,2,3,4].map(i => <div key={i} className="h-4 w-full bg-zinc-50 dark:bg-white/[0.01] rounded-full" />)}
                        </div>
                    </div>

                    {/* Placement: Sidebar/Editor Divider Handle */}
                    {placement === 'divider-handle' && (
                        <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-50">
                             <div onClick={toggle} className="w-6 h-12 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full flex items-center justify-center cursor-pointer shadow-xl">
                                <Icon name={view === 'files' ? 'common.list' : 'file.folderOpen'} size="xs" />
                             </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Placement Overlay Info */}
            <div className="absolute top-4 right-4 px-4 py-2 bg-blue-500 text-white rounded-full text-[11px] font-black uppercase tracking-widest shadow-2xl z-[100]">
                Case #{id}: {label}
            </div>
        </div>
    );
};

const ViewToggle = ({ view, onToggle, small, tiny, pill }: any) => (
    <button
        onClick={onToggle}
        className={cn(
            "flex items-center justify-center transition-all",
            tiny ? "w-6 h-6 rounded bg-zinc-100 dark:bg-white/10" :
            small ? "w-8 h-8 rounded-lg bg-zinc-100/50 dark:bg-white/5 border border-zinc-100 dark:border-white/5" :
            pill ? "px-3 py-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full text-[9px] font-black uppercase" :
            ""
        )}
    >
        <Icon name={view === 'files' ? 'common.list' : 'file.folderOpen'} size={tiny ? "xs" : "sm"} />
        {pill && <span className="ml-2">Switch View</span>}
    </button>
);

// --- MAIN LABORATORY VIEW ---

export function PracticalOutlineLab() {
    return (
        <div className="p-12 max-w-6xl mx-auto space-y-12">
            <header className="mb-24 text-center">
                <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50 mb-4 uppercase">
                    The Practical Architecture
                </h1>
                <p className="text-zinc-500 font-medium">
                    30 Production-Ready coordinates for the Files / Outline transition.
                </p>
            </header>

            <NekoRealLayout id={1} label="Sidebar Header (Utility)" placement="sidebar-header" />
            <NekoRealLayout id={2} label="Sidebar Top Tabs (macOS Finder Style)" placement="sidebar-tabs" />
            <NekoRealLayout id={3} label="Search Bar Inline (Suffix)" placement="search-suffix" />
            <NekoRealLayout id={4} label="Under Search Segmented (iOS Style)" placement="under-search" />
            <NekoRealLayout id={5} label="Smart List Entry (Hierarchy Head)" placement="list-smart-entry" />
            <NekoRealLayout id={6} label="Sidebar Footer (System Level)" placement="sidebar-footer" />
            <NekoRealLayout id={7} label="Editor Header Start (Contextual)" placement="editor-header-start" />
            <NekoRealLayout id={8} label="Editor Header End (Actionable)" placement="editor-header-end" />
            <NekoRealLayout id={9} label="Top Bar Right (Global Setting)" placement="top-right" />
            <NekoRealLayout id={10} label="Top Bar Center (Focus Selection)" placement="top-center" />
            <NekoRealLayout id={11} label="The Bridge (Divider Handle)" placement="divider-handle" />

            <div className="py-40 text-center opacity-20 italic">
                Scanning 19 remaining practical coordinates...
            </div>
        </div>
    );
}
