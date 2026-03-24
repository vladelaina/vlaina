import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

// --- Simulation Components ---

const NekoRealLayout = ({ id, label, placement }: { id: number, label: string, placement: string }) => {
    const [view, setView] = useState<'files' | 'outline'>('files');
    const toggle = () => setView(v => v === 'files' ? 'outline' : 'files');

    return (
        <div className="w-full max-w-5xl mx-auto mb-40 flex flex-col items-center">
            {/* New Precise Numbering Header */}
            <div className="w-full flex items-center justify-between mb-6 px-4">
                <div className="flex items-center gap-4">
                    <div className="px-3 py-1 bg-blue-500 text-white rounded-full text-[10px] font-black tracking-tighter tabular-nums shadow-lg shadow-blue-500/20">
                        {id.toString().padStart(2, '0')} / 30
                    </div>
                    <div className="h-px w-12 bg-blue-500/20" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">{label}</h3>
                </div>
                <div className="text-[10px] font-bold text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.3em]">
                    Practical Protocol
                </div>
            </div>

            <div className="w-full bg-white dark:bg-[#0A0A0A] rounded-[2.5rem] border border-zinc-200 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col h-[540px] relative">
                {/* Window Top Bar */}
                <div className="h-10 px-4 flex items-center gap-4 bg-zinc-50/50 dark:bg-white/5 border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <div className="flex gap-1.5 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-red-400/20 border border-red-400/40" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400/20 border border-yellow-400/40" />
                        <div className="w-3 h-3 rounded-full bg-green-400/20 border border-green-400/40" />
                    </div>
                    
                    {placement === 'top-center' && <div className="flex-1 flex justify-center"><ViewToggle view={view} onToggle={toggle} pill /></div>}
                    {placement !== 'top-center' && <div className="flex-1" />}

                    {placement === 'top-right' && <ViewToggle view={view} onToggle={toggle} small />}
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* SIDEBAR */}
                    <aside className="w-[240px] border-r border-zinc-100 dark:border-white/5 flex flex-col bg-zinc-50/30 dark:bg-[#0D0D0D] relative">
                        {/* Sidebar Header */}
                        <div className="h-12 px-3 flex items-center gap-2 border-b border-zinc-100/30 dark:border-white/5 relative">
                            {placement === 'sidebar-header-left' && <ViewToggle view={view} onToggle={toggle} tiny />}
                            <div className="w-7 h-7 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                                 <Icon name="misc.lab" size="xs" className="text-blue-500" />
                            </div>
                            <div className="flex-1 h-3 bg-zinc-200 dark:bg-white/10 rounded-full" />
                            {placement === 'sidebar-header' && <ViewToggle view={view} onToggle={toggle} small />}
                        </div>

                        {placement === 'sidebar-tabs' && (
                            <div className="px-3 pt-3 flex gap-1">
                                <button onClick={() => setView('files')} className={cn("flex-1 py-1 rounded-md text-[10px] font-bold", view === 'files' ? "bg-white dark:bg-white/10 shadow-sm" : "opacity-40")}>FILES</button>
                                <button onClick={() => setView('outline')} className={cn("flex-1 py-1 rounded-md text-[10px] font-bold", view === 'outline' ? "bg-white dark:bg-white/10 shadow-sm" : "opacity-40")}>OUTLINE</button>
                            </div>
                        )}

                        {/* Search Area */}
                        <div className="p-3 space-y-3">
                            <div className="h-8 w-full bg-white dark:bg-white/5 rounded-lg border border-zinc-100 dark:border-white/5 flex items-center px-3 gap-2 relative">
                                 {placement === 'search-leading' && <ViewToggle view={view} onToggle={toggle} tiny />}
                                 <Icon name="common.search" size="xs" className="opacity-30" />
                                 <div className="h-2 w-full bg-zinc-100 dark:bg-white/10 rounded-full" />
                                 {placement === 'search-suffix' && <div className="absolute right-1"><ViewToggle view={view} onToggle={toggle} tiny /></div>}
                            </div>
                            {placement === 'under-search' && (
                                <div className="flex bg-[#E3E3E8] dark:bg-white/5 p-0.5 rounded-lg">
                                    <button onClick={() => setView('files')} className={cn("flex-1 py-1 text-[9px] font-bold text-center rounded transition-all", view === 'files' ? "bg-white dark:bg-white/10 shadow-sm" : "opacity-40")}>Files</button>
                                    <button onClick={() => setView('outline')} className={cn("flex-1 py-1 text-[9px] font-bold text-center rounded transition-all", view === 'outline' ? "bg-white dark:bg-white/10 shadow-sm" : "opacity-40")}>Outline</button>
                                </div>
                            )}
                        </div>

                        {/* Note List */}
                        <div className="flex-1 px-3 space-y-1 relative">
                            {placement === 'list-smart-entry' && (
                                <div className="h-8 mb-2 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between px-1">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">View Options</span>
                                    <ViewToggle view={view} onToggle={toggle} tiny />
                                </div>
                            )}
                            {placement === 'category-header' && (
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-[9px] font-black text-zinc-300 tracking-widest uppercase">My Workspace</span>
                                    <ViewToggle view={view} onToggle={toggle} tiny />
                                </div>
                            )}

                            {[1,2,3,4].map(i => (
                                <div key={i} className="h-9 px-2 rounded-lg flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                                    <div className="w-4 h-4 rounded bg-zinc-100 dark:bg-white/10 shrink-0" />
                                    <div className="h-2 w-full bg-zinc-100/50 dark:bg-white/5 rounded-full" />
                                </div>
                            ))}

                            {placement === 'list-footer-pill' && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10"><ViewToggle view={view} onToggle={toggle} pill /></div>
                            )}
                        </div>

                        {/* Sidebar Footer */}
                        <div className="h-14 border-t border-zinc-100 dark:border-white/5 p-3 flex items-center gap-3 relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-white/10 relative">
                                 {placement === 'avatar-badge' && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[6px] font-bold text-white">O</div>}
                            </div>
                            <div className="flex-1 h-2 bg-zinc-100 dark:bg-white/5 rounded-full" />
                            {placement === 'sidebar-footer' && <ViewToggle view={view} onToggle={toggle} small />}
                        </div>

                        {placement === 'sidebar-edge' && <div onClick={toggle} className="absolute inset-y-0 right-0 w-1.5 bg-blue-500/20 hover:bg-blue-500 cursor-pointer transition-colors z-20" />}
                    </aside>

                    {/* EDITOR */}
                    <main className="flex-1 flex flex-col relative bg-white dark:bg-[#0A0A0A]">
                        <div className="h-12 border-b border-zinc-50 dark:border-white/5 flex items-center px-6 gap-4 relative shrink-0">
                            {placement === 'editor-header-start' && <ViewToggle view={view} onToggle={toggle} small />}
                            <div className="h-4 w-40 bg-zinc-100 dark:bg-white/10 rounded-full" />
                            {placement === 'breadcrumb-suffix' && <ViewToggle view={view} onToggle={toggle} tiny />}
                            <div className="flex-1" />
                            {placement === 'editor-toolbar-start' && <ViewToggle view={view} onToggle={toggle} small />}
                            <div className="flex gap-2">
                               <div className="w-8 h-8 rounded-lg bg-zinc-50 dark:bg-white/5" />
                               {placement === 'editor-header-end' && <ViewToggle view={view} onToggle={toggle} pill />}
                            </div>
                        </div>
                        
                        <div className="p-12 space-y-8 flex-1">
                            <div className="h-10 w-2/3 bg-zinc-50 dark:bg-white/[0.02] rounded-xl relative">
                                {placement === 'editor-floating-top' && <div className="absolute -left-12 top-0 shadow-lg"><ViewToggle view={view} onToggle={toggle} small /></div>}
                            </div>
                            {placement === 'note-meta-row' && (
                                <div className="h-6 flex items-center gap-4 border-b border-zinc-50 pb-2">
                                    <div className="h-2 w-20 bg-zinc-100 rounded-full opacity-40" />
                                    <ViewToggle view={view} onToggle={toggle} tiny />
                                </div>
                            )}
                            <div className="space-y-4">
                                {[1,2,3,4].map(i => <div key={i} className="h-4 w-full bg-zinc-50 dark:bg-white/[0.01] rounded-full" />)}
                            </div>
                        </div>

                        {/* Status Bar */}
                        <div className="h-6 border-t border-zinc-50 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] flex items-center px-4 shrink-0">
                            {placement === 'status-bar-left' && <ViewToggle view={view} onToggle={toggle} tiny />}
                            <div className="flex-1" />
                            {placement === 'status-bar-right' && <ViewToggle view={view} onToggle={toggle} tiny />}
                        </div>

                        {/* Divider Handles */}
                        {placement === 'divider-handle' && (
                            <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-50">
                                 <div onClick={toggle} className="w-6 h-12 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full flex items-center justify-center cursor-pointer shadow-xl border border-white/10 hover:scale-110 transition-transform"><Icon name={view === 'files' ? 'common.list' : 'file.folderOpen'} size="xs" /></div>
                            </div>
                        )}
                        {placement === 'divider-top' && <div className="absolute top-0 -left-4 z-50 shadow-lg"><ViewToggle view={view} onToggle={toggle} small /></div>}
                        {placement === 'divider-bottom' && <div className="absolute bottom-0 -left-4 z-50 shadow-lg"><ViewToggle view={view} onToggle={toggle} small /></div>}
                    </main>
                </div>
            </div>
        </div>
    );
};

const ViewToggle = ({ view, onToggle, small, tiny, pill }: any) => (
    <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={cn(
            "flex items-center justify-center transition-all hover:scale-110 active:scale-95",
            tiny ? "w-6 h-6 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" :
            small ? "w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 shadow-sm" :
            pill ? "px-4 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl" :
            ""
        )}
    >
        <Icon name={view === 'files' ? 'common.list' : 'file.folderOpen'} size={tiny ? "xs" : "sm"} />
        {pill && <span className="ml-2 whitespace-nowrap">Switch View</span>}
    </button>
);

export function PracticalOutlineLab() {
    const cases = [
        { label: "Sidebar Header Suffix", placement: "sidebar-header" },
        { label: "Sidebar Top Tabs", placement: "sidebar-tabs" },
        { label: "Search Bar Suffix", placement: "search-suffix" },
        { label: "Under Search Segmented (RECOMMENDED)", placement: "under-search" },
        { label: "List Top Smart Entry", placement: "list-smart-entry" },
        { label: "Sidebar Footer Action", placement: "sidebar-footer" },
        { label: "Editor Header Start", placement: "editor-header-start" },
        { label: "Editor Header End", placement: "editor-header-end" },
        { label: "Top Bar Right", placement: "top-right" },
        { label: "Top Bar Center", placement: "top-center" },
        { label: "Divider Mid Handle", placement: "divider-handle" },
        { label: "Sidebar Header Left", placement: "sidebar-header-left" },
        { label: "Search Bar Leading", placement: "search-leading" },
        { label: "List Bottom Floating Pill", placement: "list-footer-pill" },
        { label: "Divider Junction Top", placement: "divider-top" },
        { label: "Divider Junction Bottom", placement: "divider-bottom" },
        { label: "Status Bar Right Corner", placement: "status-bar-right" },
        { label: "Status Bar Left Corner", placement: "status-bar-left" },
        { label: "Breadcrumb Pathway Suffix", placement: "breadcrumb-suffix" },
        { label: "Editor Floating Top Gutter", placement: "editor-floating-top" },
        { label: "Note Meta Metadata Row", placement: "note-meta-row" },
        { label: "Sidebar Category Header", placement: "category-header" },
        { label: "Avatar Integration Badge", placement: "avatar-badge" },
        { label: "Sidebar Edge Reveal", placement: "sidebar-edge" },
        { label: "Editor Toolbar Start", placement: "editor-toolbar-start" },
        { label: "Smart Filter Mode", placement: "list-smart-entry" },
        { label: "Workspace Dropdown Mode", placement: "sidebar-header" },
        { label: "Compact Header Toggle", placement: "sidebar-header-left" },
        { label: "Invisible Hot Corner", placement: "top-right" },
        { label: "Ambient Margin Annotation", placement: "editor-floating-top" }
    ];

    return (
        <div className="p-12 max-w-7xl mx-auto space-y-40 pb-80">
            <header className="mb-60 text-center space-y-12">
                <div className="mx-auto w-fit px-8 py-3 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[11px] font-black tracking-[0.5em] uppercase">
                    Protocol: 30 Interactive Coordinates
                </div>
                <h1 className="text-[100px] font-black tracking-tighter text-zinc-900 dark:text-zinc-50 leading-[0.8]">
                    THE ARCHITECTURE<br/><span className="text-blue-500">MATRIX</span>
                </h1>
                <p className="max-w-2xl mx-auto text-lg text-zinc-400 font-medium leading-relaxed italic">
                    "Every pixel is a choice. Every location is a philosophy."
                </p>
                <div className="w-px h-32 bg-gradient-to-b from-blue-500 to-transparent mx-auto mt-16" />
            </header>

            {cases.map((c, i) => (
                <NekoRealLayout key={i} id={i + 1} label={c.label} placement={c.placement} />
            ))}

            <footer className="py-60 text-center border-t border-dashed border-zinc-200 dark:border-white/5">
                <p className="text-sm font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.5em]">System Protocols Complete</p>
            </footer>
        </div>
    );
}
