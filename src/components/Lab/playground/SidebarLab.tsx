import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FileText, MessageSquare, Activity, FlaskConical, Search, Settings, Home, Inbox, Star, Plus, ChevronRight, Hash, Layers, Command, User, Globe, Layout, Zap, ChevronDown, MoreHorizontal, Folder } from 'lucide-react';

const MENU = [{ icon: FileText, label: 'Notes' }, { icon: MessageSquare, label: 'Chat', active: true }, { icon: Activity, label: 'Progress' }, { icon: FlaskConical, label: 'Lab' }];

const Mock = () => <div className="flex-1 bg-white dark:bg-[#0c0c0c] p-12 border-l border-zinc-100 dark:border-white/5 opacity-40"><div className="w-48 h-10 bg-zinc-100 dark:bg-white/10 rounded-xl mb-8" /><div className="w-full h-4 bg-zinc-50 dark:bg-white/5 rounded-md mb-4" /><div className="w-5/6 h-4 bg-zinc-50 dark:bg-white/5 rounded-md" /></div>;

const VARS: Record<string, React.FC> = {
  "Notion Minimal (Preserved)": () => (
    <div className="w-64 h-full bg-[#f7f7f5] dark:bg-[#181818] border-r border-black/5 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-6 font-bold text-zinc-700 dark:text-zinc-300">Vladelaina's Vault</div>
      {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-2 px-2 py-1 rounded text-[13px]", it.active ? "bg-black/5 dark:bg-white/10 font-bold" : "text-zinc-500 hover:bg-black/5")}>{it.label}</div>)}
    </div>
  ),
  "Vibrancy Pro (Preserved)": () => (
    <div className="w-64 h-full bg-white/20 dark:bg-black/20 backdrop-blur-xl border-r border-white/10 p-4 flex flex-col">
      <div className="h-12 flex gap-2 mb-8 items-center"><div className="w-3 h-3 bg-red-400 rounded-full"/><div className="w-3 h-3 bg-yellow-400 rounded-full"/><div className="w-3 h-3 bg-green-400 rounded-full"/></div>
      {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer", it.active ? "bg-blue-500 text-white shadow-lg" : "text-zinc-700 dark:text-zinc-300")}>
        <it.icon size={16} /> <span className="text-[13px] font-medium">{it.label}</span>
      </div>)}
    </div>
  ),
  "Absolute Zero": () => (
    <div className="w-56 h-full bg-white dark:bg-black border-r-[0.5px] border-zinc-200 p-8 pt-20 flex flex-col gap-6">
      {MENU.map((it, i) => <div key={i} className={cn("text-[14px] tracking-tight cursor-pointer", it.active ? "text-black dark:text-white font-black" : "text-zinc-300")}>{it.label}</div>)}
    </div>
  ),
  "Linear Professional": () => (
    <div className="w-60 h-full bg-[#1e1e22] text-[#8a8f98] border-r border-[#2d2d34] p-4 flex flex-col">
      <div className="flex items-center gap-3 py-3 mb-6 border-b border-[#2d2d34] text-white font-bold text-[13px]">NekoTick HQ</div>
      {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-3 px-2 py-1.5 rounded-md cursor-pointer text-[13px]", it.active ? "bg-[#2d2d34] text-white shadow-sm" : "hover:text-white")}><it.icon size={15}/>{it.label}</div>)}
    </div>
  ),
  "Arc Spaces": () => (
    <div className="w-72 h-full bg-[#f4f4f4] dark:bg-[#1a1a1c] p-3 border-r border-black/5">
      <div className="bg-white dark:bg-[#2a2a2d] rounded-2xl p-2 flex flex-col gap-1 border border-black/5 h-full shadow-sm">
        <div className="h-9 bg-black/5 rounded-xl flex items-center px-3 mb-4 text-xs text-black/40">Search...</div>
        {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-[13px]", it.active ? "bg-black/5 font-bold" : "text-zinc-500")}><it.icon size={16}/>{it.label}</div>)}
      </div>
    </div>
  ),
  "Craft Style": () => (
    <div className="w-64 h-full bg-[#fafafa] dark:bg-[#111] border-r border-black/5 p-6 flex flex-col gap-8">
      <div className="font-bold text-[15px]">Workspace <Plus size={14} className="float-right"/></div>
      <div className="flex flex-col gap-1">
        {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all", it.active ? "bg-white dark:bg-zinc-800 shadow-md text-blue-500 scale-105" : "text-zinc-500 hover:bg-black/5")}><it.icon size={16}/> <span className={cn(it.active && "text-black dark:text-white font-black")}>{it.label}</span></div>)}
      </div>
    </div>
  ),
  "Figma Tool": () => (
    <div className="w-64 h-full bg-[#2c2c2c] text-[#b3b3b3] border-r border-[#383838] flex flex-col text-[11px] font-semibold">
      <div className="flex items-center gap-3 px-4 h-10 border-b border-[#383838] text-white hover:bg-[#383838]">Project File</div>
      <div className="p-2 flex flex-col gap-1">
        <div className="px-2 py-1.5 mb-1 hover:bg-[#383838] rounded flex items-center gap-2 cursor-pointer text-white"><Layers size={12}/> Layers</div>
        {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer", it.active ? "text-[#18a0fb] bg-[#18a0fb]/10" : "hover:text-white")}><it.icon size={12}/>{it.label}</div>)}
      </div>
    </div>
  ),
  "Xcode Style": () => (
    <div className="w-64 h-full bg-[#f5f5f5] dark:bg-[#1e1e1e] border-r border-[#d4d4d4] flex flex-col text-[12px]">
      <div className="flex justify-around items-center h-7 bg-[#e8e8e8] dark:bg-[#252525] border-b border-[#d4d4d4]"><Folder size={14} className="text-blue-500"/><Search size={14}/><Activity size={14}/><Settings size={14}/></div>
      <div className="p-2 overflow-y-auto">
        <div className="px-1 py-1 font-bold text-[11px] flex items-center gap-1 uppercase tracking-tighter text-zinc-400">Project_Explorer</div>
        <div className="pl-3 mt-2 flex flex-col gap-0.5">{MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-1 px-1 py-0.5 cursor-pointer", it.active ? "bg-[#0058d0] text-white" : "hover:bg-zinc-200 dark:hover:bg-zinc-800")}><it.icon size={14} className={it.active ? "text-white" : "text-blue-500"}/>{it.label}</div>)}</div>
      </div>
    </div>
  ),
  "Slack Sidebar": () => (
    <div className="w-64 h-full bg-[#3F0E40] text-[#cfc3cf] flex flex-col font-sans">
      <div className="h-12 border-b border-[#5d2c5d] flex items-center px-4 text-white font-black">NekoTick HQ</div>
      <div className="p-2 flex flex-col gap-0.5">
        <div className="px-2 py-1 text-[15px] hover:bg-[#350d36] rounded flex items-center gap-2"><MessageSquare size={16}/> Threads</div>
        <div className="mt-4 mb-1 px-2 text-[13px] font-bold uppercase opacity-60">Channels <Plus size={14} className="float-right"/></div>
        {MENU.map((it, i) => <div key={i} className={cn("px-2 py-1 text-[15px] rounded cursor-pointer flex items-center gap-1", it.active ? "bg-[#1164A3] text-white font-bold" : "hover:bg-[#350d36]")}><Hash size={14} className="opacity-50"/> {it.label}</div>)}
      </div>
    </div>
  ),
  "Raycast Palette": () => (
    <div className="w-80 h-full p-4 bg-zinc-100 dark:bg-black shrink-0">
      <div className="w-full h-full bg-white dark:bg-[#1a1a1a] rounded-[24px] shadow-2xl border border-black/5 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-black/5 text-[18px] text-zinc-300">Search commands...</div>
        <div className="p-2 flex flex-col gap-1">
          {MENU.map((it, i) => <div key={i} className={cn("flex justify-between items-center px-3 py-2 rounded-xl cursor-pointer text-[14px]", it.active ? "bg-[#ff6363] text-white shadow-lg" : "hover:bg-black/5 text-zinc-700")}><div className="flex items-center gap-3"><it.icon size={16}/>{it.label}</div><span className="opacity-30">↵</span></div>)}
        </div>
      </div>
    </div>
  ),
  "Floating Pillar": () => (
    <div className="w-24 h-full bg-transparent flex items-center justify-center shrink-0">
      <div className="flex flex-col items-center gap-4 p-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-black/5">
        <div className="w-12 h-12 bg-black dark:bg-white rounded-2xl flex items-center justify-center text-white dark:text-black font-black text-xl">N</div>
        <div className="w-8 h-px bg-zinc-200 dark:bg-zinc-800" />
        {MENU.map((it, i) => <div key={i} className={cn("w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-all", it.active ? "bg-black text-white shadow-xl scale-110" : "text-zinc-400 hover:bg-zinc-100")}>
          <it.icon size={22} strokeWidth={it.active ? 3 : 2} />
        </div>)}
      </div>
    </div>
  ),
  "GitHub Repository": () => (
    <div className="w-72 h-full bg-[#f6f8fa] dark:bg-[#0d1117] border-r border-[#d0d7de] flex flex-col text-[#24292f] font-sans">
      <div className="p-4 border-b border-[#d0d7de] flex items-center gap-2 font-semibold text-[14px]">nekotick / core</div>
      <div className="flex flex-col p-2 gap-[2px]">
        {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md text-[14px] cursor-pointer", it.active ? "bg-[#0969da] text-white font-bold" : "hover:bg-[#d0d7de]/40 text-[#57606a]")}><it.icon size={16} />{it.label}</div>)}
      </div>
    </div>
  ),
  "Mac System Prefs": () => (
    <div className="w-60 h-full bg-[#e8e8e8] dark:bg-[#1e1e1e] border-r border-[#d4d4d4] flex flex-col p-2 gap-4">
      <div className="bg-white dark:bg-[#2d2d2d] rounded-lg border border-[#d4d4d4] p-1 flex flex-col gap-[2px]">
        {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer", it.active ? "bg-[#0058d0] text-white" : "hover:bg-black/5")}>
          <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white", i===0?"bg-blue-500":i===1?"bg-green-500":i===2?"bg-orange-500":"bg-purple-500")}><it.icon size={14}/></div><span className="text-[13px] font-medium">{it.label}</span>
        </div>)}
      </div>
    </div>
  ),
  "Brutalist Spec": () => (
    <div className="w-72 h-full bg-white border-r-4 border-black flex flex-col p-8 font-mono text-black">
      <div className="text-5xl font-black mb-12 tracking-tighter border-b-4 border-black pb-4 uppercase italic underline text-black">NAV_CTRL</div>
      <div className="flex flex-col gap-0">{MENU.map((it, i) => <div key={i} className={cn("p-4 border-4 border-b-0 last:border-b-4 border-black flex justify-between items-center cursor-pointer font-black uppercase text-sm shadow-[4px_4px_0_black]", it.active ? "bg-[#ff0055] text-white" : "bg-white hover:bg-zinc-50")}>{it.label} <it.icon size={16}/></div>)}</div>
    </div>
  ),
  "The Index": () => (
    <div className="w-72 h-full bg-[#fdfdfc] dark:bg-[#121212] border-r border-zinc-200 flex flex-col p-12 font-serif shrink-0">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-12 font-sans font-black">Archive_Index</div>
      <div className="flex flex-col gap-8">{MENU.map((it, i) => <div key={i} className={cn("flex items-baseline gap-4 cursor-pointer group transition-all")}>
        <span className={cn("font-mono text-xs opacity-20", it.active && "text-purple-600 opacity-100 font-bold")}>0{i+1}</span>
        <span className={cn("text-2xl font-light transition-all group-hover:translate-x-2", it.active ? "text-black dark:text-white font-black italic" : "text-zinc-300 dark:text-zinc-800 hover:text-black")}>{it.label}</span>
      </div>)}</div>
    </div>
  ),
  "Typo Vertical": () => (
    <div className="w-20 h-full bg-[#fafafa] dark:bg-[#050505] border-r border-black/5 flex flex-col items-center py-12 gap-16 shrink-0">
      {MENU.map((it, i) => <span key={i} className={cn("writing-vertical-rl -rotate-180 text-xl tracking-[0.3em] uppercase font-black cursor-pointer transition-all hover:scale-105", it.active ? "text-purple-600 shadow-purple-500/20" : "text-zinc-200 dark:text-zinc-800 hover:text-zinc-400")}>{it.label}</span>)}
    </div>
  ),
  "Badge Rail": () => (
    <div className="w-24 h-full bg-white dark:bg-black border-r border-zinc-100 flex flex-col items-center py-8 gap-6">
      {MENU.map((it, i) => <div key={i} className="relative cursor-pointer group">
        <div className={cn("w-12 h-12 flex items-center justify-center rounded-2xl transition-all", it.active ? "bg-black text-white dark:bg-white dark:text-black shadow-lg" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 group-hover:bg-zinc-200")}>
          <it.icon size={20} />
        </div>
        {i === 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-black" />}
      </div>)}
    </div>
  ),
  "Clean Separator": () => (
    <div className="w-64 h-full bg-white dark:bg-[#0a0a0a] border-r border-zinc-200 flex flex-col">
      <div className="p-6 border-b border-zinc-200 font-black text-xl">Neko.</div>
      {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-4 px-6 py-5 border-b border-zinc-100 cursor-pointer transition-colors", it.active ? "bg-zinc-50 dark:bg-zinc-900 text-purple-600 font-black" : "text-zinc-500 hover:bg-zinc-50")}>
        <it.icon size={18} /> <span className="text-[14px]">{it.label}</span>
      </div>)}
    </div>
  ),
  "Glass Morphism": () => (
    <div className="w-[300px] h-full flex flex-col justify-center p-6 border-r border-zinc-100 relative overflow-hidden bg-zinc-50/50 dark:bg-black">
      <div className="absolute top-1/4 -left-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
      <div className="relative bg-white/40 dark:bg-white/5 backdrop-blur-2xl rounded-[2rem] border border-white/40 p-4 shadow-2xl flex flex-col gap-2">
        {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all", it.active ? "bg-white/60 dark:bg-white/10 font-bold shadow-sm" : "opacity-70")}>
          <it.icon size={18} /> <span className="text-sm">{it.label}</span>
        </div>)}
      </div>
    </div>
  ),
  "Eclipse UI": () => (
    <div className="w-[280px] h-full bg-[#050505] flex flex-col p-8 shrink-0 relative overflow-hidden border-r border-white/10">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 blur-3xl opacity-50" />
      <div className="flex items-center gap-4 mb-16 relative z-10"><div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white"><Command size={20}/></div><span className="font-bold tracking-tighter text-white uppercase italic">Neko_OS</span></div>
      <div className="flex flex-col gap-4 relative z-10">
        {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-4 px-6 py-4 rounded-full border transition-all cursor-pointer", it.active ? "border-white/20 bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]" : "border-transparent text-zinc-600 hover:text-zinc-300")}>
          <it.icon size={18} /> <span className="text-sm font-bold uppercase tracking-widest">{it.label}</span>
        </div>)}
      </div>
    </div>
  ),
  "Folder Tabs": () => (
    <div className="w-64 h-full bg-transparent flex flex-col pt-12 pr-4 shrink-0 border-r border-zinc-100">
      {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-4 px-6 py-4 rounded-r-2xl cursor-pointer shadow-sm border border-l-0 mb-2 transition-all", it.active ? "bg-white dark:bg-zinc-900 border-zinc-200 translate-x-4 z-10" : "bg-zinc-100/80 dark:bg-zinc-800/80 border-transparent text-zinc-500 hover:translate-x-2")}>
        <it.icon size={20} /> <span className="font-bold text-sm tracking-tight">{it.label}</span>
      </div>)}
    </div>
  ),
  "Minimalist Rail": () => (
    <div className="w-16 h-full bg-white dark:bg-[#111] border-r border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-6 gap-6 shrink-0">
      <div className="w-8 h-8 bg-black dark:bg-white rounded-lg mb-4" />
      {MENU.map((it, i) => <div key={i} className={cn("relative w-10 h-10 flex items-center justify-center rounded-xl cursor-pointer group", it.active ? "bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white" : "text-zinc-400 hover:bg-zinc-50")}>
        {it.active && <div className="absolute left-0 w-1 h-5 bg-black dark:bg-white rounded-r-full" />}
        <it.icon size={20} />
      </div>)}
    </div>
  ),
  "The Notch": () => (
    <div className="w-64 h-full bg-white dark:bg-black flex flex-col shrink-0 border-r border-zinc-100">
      <div className="mt-12 mx-auto w-40 h-8 bg-black dark:bg-zinc-800 rounded-full mb-12 flex items-center justify-center text-[10px] font-black text-white uppercase tracking-tighter">NekoTick_v1</div>
      {MENU.map((it, i) => <div key={i} className={cn("mx-4 flex items-center gap-4 py-4 px-6 rounded-[2rem] cursor-pointer transition-all", it.active ? "bg-zinc-100 dark:bg-zinc-900" : "opacity-30 hover:opacity-60")}>
        <it.icon size={20} />
        <span className="font-black text-xs uppercase">{it.label}</span>
      </div>)}
    </div>
  ),
  "Floating Bubble": () => (
    <div className="w-24 h-full bg-transparent flex flex-col items-center justify-center shrink-0 border-r border-zinc-100">
      <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl p-2 rounded-full shadow-2xl border border-black/5 flex flex-col gap-2">
        {MENU.map((it, i) => <div key={i} className={cn("w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all", it.active ? "bg-black text-white dark:bg-white dark:text-black shadow-md scale-105" : "text-zinc-500 hover:bg-black/5")}>
          <it.icon size={20} strokeWidth={it.active ? 2.5 : 2} />
        </div>)}
      </div>
    </div>
  ),
  "Ceramic Solid": () => (
    <div className="w-64 h-full bg-[#fcfcfc] dark:bg-[#0a0a0a] flex flex-col p-6 gap-4 border-r border-zinc-200 shadow-2xl shrink-0">
      <div className="text-xs font-black uppercase mb-8 border-l-4 border-black dark:border-white pl-4 text-black dark:text-white">System</div>
      {MENU.map((it, i) => <div key={i} className={cn("flex items-center justify-between p-4 border-2 transition-all active:scale-95", it.active ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black rounded-2xl shadow-xl" : "border-zinc-100 dark:border-zinc-900 rounded-xl hover:border-zinc-300")}>
        <span className="font-black uppercase text-xs tracking-widest">{it.label}</span>
        <it.icon size={14} />
      </div>)}
    </div>
  ),
  "Aura Flow": () => (
    <div className="w-[280px] h-full bg-white dark:bg-[#050505] flex flex-col p-8 gap-2 shrink-0 border-r border-zinc-100 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-blue-500/5 pointer-events-none" />
      {MENU.map((it, i) => <div key={i} className={cn("relative group px-6 py-4 rounded-3xl cursor-pointer transition-all", it.active ? "text-black dark:text-white" : "text-zinc-400")}>
        {it.active && <motion.div layoutId="aura" className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-3xl" />}
        <div className="flex items-center gap-4 relative z-10">
          <it.icon size={20} strokeWidth={it.active ? 2.5 : 2} />
          <span className="text-base font-black tracking-tight">{it.label}</span>
        </div>
      </div>)}
    </div>
  ),
  "Blueprint": () => (
    <div className="w-64 h-full bg-[#0047ff] text-white/80 flex flex-col p-10 font-mono gap-10 shrink-0 border-r border-white/20">
      <div className="border border-white/40 p-4 text-[10px] leading-tight">ARCHITECTURAL_SPEC_V1.0<br/>NEKOTICK_WORKSPACE</div>
      {MENU.map((it, i) => <div key={i} className={cn("relative pl-8 cursor-pointer group", it.active ? "text-white font-black" : "hover:text-white")}>
        <div className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-4 h-[1px] bg-current opacity-40 group-hover:w-6 transition-all")} />
        {it.label.toUpperCase()}
      </div>)}
    </div>
  ),
  "Segmented Tabs": () => (
    <div className="w-64 h-full bg-white dark:bg-black border-r border-zinc-100 p-6 flex flex-col gap-1 shrink-0">
      <div className="p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex flex-col gap-1">
        {MENU.map((it, i) => <div key={i} className={cn("flex items-center gap-3 px-4 py-2 rounded-lg transition-all cursor-pointer text-sm font-bold", it.active ? "bg-white dark:bg-zinc-800 shadow-sm text-black dark:text-white" : "text-zinc-500 hover:bg-zinc-200/50")}>
          <it.icon size={16} />{it.label}
        </div>)}
      </div>
    </div>
  ),
  "Micro Mono": () => (
    <div className="w-48 h-full bg-white dark:bg-black border-r border-zinc-100 flex flex-col p-6 shrink-0 font-mono text-[10px]">
      <div className="mb-12 opacity-30">V1.0.4_RELEASE</div>
      <div className="flex flex-col gap-4">
        {MENU.map((it, i) => <div key={i} className={cn("cursor-pointer group flex items-center gap-2", it.active ? "text-black dark:text-white" : "text-zinc-400")}>
          <span className="opacity-20 group-hover:opacity-100 transition-opacity">[{it.active ? "*" : " "}]</span>
          {it.label.toUpperCase()}
        </div>)}
      </div>
    </div>
  ),
  "Textual Pure": () => (
    <div className="w-64 h-full bg-white dark:bg-black border-r border-zinc-100 flex flex-col p-10 justify-center gap-8 shrink-0">
      {MENU.map((it, i) => <div key={i} className={cn("text-4xl font-light tracking-tighter cursor-pointer transition-all", it.active ? "font-black scale-110 translate-x-2 text-black dark:text-white" : "opacity-20 hover:opacity-50")}>
        {it.label}
      </div>)}
    </div>
  ),
  "The Blade": () => (
    <div className="w-16 h-full bg-black dark:bg-white flex flex-col items-center py-8 gap-10 shrink-0 border-r border-zinc-100">
      <div className="w-8 h-8 rounded-full border-2 border-white/20 dark:border-black/20" />
      {MENU.map((it, i) => <div key={i} className={cn("relative group cursor-pointer", it.active ? "text-white dark:text-black" : "text-zinc-600 hover:text-zinc-400")}>
        {it.active && <div className="absolute -left-4 w-1 h-6 bg-white dark:bg-black rounded-r-full" />}
        <it.icon size={22} />
      </div>)}
    </div>
  ),
  };

  // Procedural generation for #31 to #52 with high variability
  for(let i = 31; i <= 52; i++) {
  const dark = i % 2 === 0;
  const compact = i % 3 === 0;
  const layout = i % 4; // 0: Pill, 1: Line, 2: Box, 3: Underline
  const align = i % 5 === 0 ? "items-center" : "items-start";

  VARS[`Architecture Spec v${i}`] = () => (
    <div className={cn(
      "h-full flex flex-col shrink-0 relative transition-all duration-500",
      compact ? "w-20 items-center py-8" : "w-64 px-6 py-10",
      dark ? "bg-[#050505] text-white border-r border-white/5" : "bg-[#fcfcfc] text-black border-r border-black/5",
      align
    )}>
      {dark && <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none" />}
      <div className="flex flex-col gap-4 w-full z-10">
        {MENU.map((item, idx) => (
          <div key={idx} className={cn(
            "flex cursor-pointer transition-all items-center gap-4 w-full",
            compact ? "justify-center aspect-square rounded-2xl" : "justify-start px-4 py-3 rounded-xl",
            layout === 0 && "rounded-full " + (item.active ? (dark ? "bg-white text-black shadow-lg" : "bg-black text-white shadow-lg") : "opacity-40 hover:opacity-100"),
            layout === 1 && "border-l-2 " + (item.active ? "border-purple-500 pl-4 font-bold" : "border-transparent opacity-30 hover:opacity-100"),
            layout === 2 && "border border-transparent " + (item.active ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-inner" : "opacity-40 hover:opacity-100"),
            layout === 3 && "px-0 " + (item.active ? "font-bold tracking-widest uppercase underline underline-offset-8" : "opacity-20 hover:opacity-60")
          )}>
            <item.icon size={compact ? 24 : 18} strokeWidth={item.active ? 3 : 2} />
            {!compact && <span className="text-[13px]">{item.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
  }

  export function SidebarLab() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8 lg:p-16 flex flex-col">
      <div className="max-w-[1600px] mx-auto w-full space-y-24">
        <div className="flex flex-col gap-6 text-center max-w-4xl mx-auto">
          <h2 className="text-[80px] font-black tracking-tighter uppercase italic leading-[0.9]">The Navigation<br/>Manifesto</h2>
          <p className="text-zinc-500 text-xl font-medium">52 unique architectural directions for global scale software. Preserving the essence, exploring the infinite.</p>
        </div>

        <div className="flex flex-col gap-40 pb-64">
          {Object.entries(VARS).map(([name, Comp], index) => (
            <div key={name} className="flex flex-col gap-8 group">
              <div className="flex items-end justify-between border-b border-zinc-200 dark:border-zinc-800 pb-6">
                <div className="flex items-baseline gap-6">
                  <span className="text-[120px] font-black text-zinc-100 dark:text-zinc-900 leading-[0.8] group-hover:text-purple-500/20 transition-colors">#{String(index + 1).padStart(2, '0')}</span>
                  <h3 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{name}</h3>
                </div>
                <div className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                  Architecture Spec
                </div>
              </div>

              <div className="h-[700px] flex rounded-[3rem] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-zinc-200/50 dark:border-zinc-800/50 bg-[#e5e5e5] dark:bg-[#000]">
                <Comp />
                <Mock />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
