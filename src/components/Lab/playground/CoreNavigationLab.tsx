import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  ChevronRight, 
  Search,
  Cpu,
  Layers,
  Fingerprint,
  FileText,
  Radio,
  Anchor,
  Hash,
  Eye,
  Zap as Power,
  Atom,
  Cpu as Engine,
  Magnet,
  Spline
} from 'lucide-react';

/**
 * CORE NAVIGATION LAB v11 - "SENSORY PRECISION"
 * 30 New Masterful Schemes (301-330) + 11 Reserved Masterpieces
 */

type Mode = 'chat' | 'notes';

interface NavSchemeProps {
  mode: Mode;
  setMode: (m: Mode) => void;
}

// --- RESERVED MASTERPIECES (The Chosen Eleven) ---

const ReservedSchemes: Record<string, React.FC<NavSchemeProps>> = {
  "00. The Original Pill": ({ mode, setMode }) => (
    <div className="absolute top-8 left-8 z-50 flex items-center bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-black/5 rounded-full p-1 shadow-2xl">
      <div className="flex bg-black/[0.03] dark:bg-white/5 rounded-full p-0.5 relative">
        <button onClick={() => setMode('notes')} className={cn("relative z-10 px-5 py-1.5 rounded-full text-[11px] font-bold tracking-tight transition-all", mode === 'notes' ? "text-black dark:text-white" : "text-zinc-400")}>Notes</button>
        <button onClick={() => setMode('chat')} className={cn("relative z-10 px-5 py-1.5 rounded-full text-[11px] font-bold tracking-tight transition-all", mode === 'chat' ? "text-black dark:text-white" : "text-zinc-400")}>Chat</button>
        <motion.div layoutId="pill-bg-v11" animate={{ x: mode === 'notes' ? 0 : '100%' }} className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] bg-white dark:bg-zinc-800 shadow-sm rounded-full" />
      </div>
    </div>
  ),

  "11. Pure Segment": ({ mode, setMode }) => (
    <div className="absolute top-8 left-8 z-50 flex gap-8">
       {['notes', 'chat'].map((m) => (
         <button key={m} onClick={() => setMode(m as Mode)} className={cn("text-xs font-black uppercase tracking-[0.2em] transition-all", mode === m ? "text-black opacity-100" : "text-zinc-300 opacity-50")}>{m}</button>
       ))}
    </div>
  ),

  "24. Minimal Vertical": ({ mode, setMode }) => (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-10">
       <button onClick={() => setMode('notes')} className={cn("rotate-[-90deg] text-[9px] font-black tracking-widest transition-all", mode === 'notes' ? "text-black scale-125" : "text-zinc-200")}>NOTES</button>
       <button onClick={() => setMode('chat')} className={cn("rotate-[-90deg] text-[9px] font-black tracking-widest transition-all", mode === 'chat' ? "text-black scale-125" : "text-zinc-200")}>CHAT</button>
    </div>
  ),

  "34. Sidebar Base": ({ mode, setMode }) => (
    <div className="absolute bottom-6 left-6 w-56 z-50">
       <div className="flex items-center justify-between border-t border-black/5 pt-4 group">
          <div className="flex gap-4">
             <button onClick={() => setMode('notes')} className={cn("text-[10px] font-black transition-colors", mode === 'notes' ? "text-black" : "text-zinc-300")}>ARCHIVE</button>
             <button onClick={() => setMode('chat')} className={cn("text-[10px] font-black transition-colors", mode === 'chat' ? "text-black" : "text-zinc-300")}>AGENT</button>
          </div>
          <div className={cn("w-1.5 h-1.5 rounded-full transition-all duration-500", mode === 'notes' ? "bg-black shadow-[0_0_8px_black]" : "bg-purple-500 shadow-[0_0_8px_purple]")} />
       </div>
    </div>
  ),

  "51. Dynamic Width": ({ mode, setMode }) => (
    <div className="absolute top-8 left-8 z-50">
       <motion.div animate={{ width: mode === 'notes' ? 120 : 160 }} className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full flex relative h-9">
          <button onClick={() => setMode('notes')} className={cn("flex-1 z-10 text-[10px] font-black", mode === 'notes' ? "text-black" : "text-zinc-400")}>NOTES</button>
          <button onClick={() => setMode('chat')} className={cn("flex-1 z-10 text-[10px] font-black", mode === 'chat' ? "text-black" : "text-zinc-400")}>ASSISTANT</button>
          <motion.div layoutId="pill-morph-v11" animate={{ left: mode === 'notes' ? '4px' : 'calc(50% + 2px)', width: 'calc(50% - 6px)' }} className="absolute inset-y-1 bg-white dark:bg-zinc-700 shadow-sm rounded-full" />
       </motion.div>
    </div>
  ),

  "81. The Glass Tablet": ({ mode, setMode }) => (
    <div className="absolute top-8 right-8 z-50 bg-white/20 backdrop-blur-3xl border border-white/30 rounded-2xl p-1.5 shadow-2xl flex flex-col gap-1">
       <button onClick={() => setMode('notes')} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", mode === 'notes' ? "bg-white text-black shadow-lg" : "text-white/40")}><FileText size={20}/></button>
       <button onClick={() => setMode('chat')} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", mode === 'chat' ? "bg-white text-black shadow-lg" : "text-white/40")}><Cpu size={20}/></button>
    </div>
  ),

  "90. The Minimalist Fold": ({ mode, setMode }) => (
    <div className="absolute bottom-6 left-6 w-56 z-50">
       <div className="bg-zinc-50 rounded-xl p-1 flex border border-black/5 shadow-inner">
          <button onClick={() => setMode('notes')} className={cn("flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all", mode === 'notes' ? "bg-white text-black shadow-sm" : "text-zinc-300")}>LIST</button>
          <button onClick={() => setMode('chat')} className={cn("flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all", mode === 'chat' ? "bg-white text-black shadow-sm" : "text-zinc-300")}>CORE</button>
       </div>
    </div>
  ),

  "118. Glass Horizon": ({ mode, setMode }) => (
    <div className="absolute bottom-0 left-64 right-0 h-1 z-50 flex px-20 gap-4 opacity-40">
       <button onClick={() => setMode('notes')} className={cn("flex-1 h-full rounded-t-full transition-all duration-700", mode === 'notes' ? "bg-black" : "bg-zinc-100 hover:bg-zinc-200")} />
       <button onClick={() => setMode('chat')} className={cn("flex-1 h-full rounded-t-full transition-all duration-700", mode === 'chat' ? "bg-black" : "bg-zinc-100 hover:bg-zinc-200")} />
    </div>
  ),

  "126. Sidebar Footer (Icon)": ({ mode, setMode }) => (
    <div className="absolute bottom-6 left-6 w-56 z-50 flex justify-center">
       <div className="flex bg-zinc-50 p-1 rounded-full border border-black/5 gap-1">
          <button onClick={() => setMode('notes')} className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all", mode === 'notes' ? "bg-white shadow-sm" : "opacity-20")}><Layers size={14}/></button>
          <button onClick={() => setMode('chat')} className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all", mode === 'chat' ? "bg-white shadow-sm" : "opacity-20")}><Cpu size={14}/></button>
       </div>
    </div>
  ),

  "130. Optical Illusion Divider": ({ mode, setMode }) => (
    <div className="absolute left-64 top-0 bottom-0 w-8 z-50 pointer-events-auto cursor-pointer group" onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}>
       <div className="w-full h-full relative overflow-hidden">
          <motion.div animate={{ y: mode === 'notes' ? '0%' : '100%' }} className="absolute inset-x-0 top-0 h-1/2 bg-black opacity-[0.02] group-hover:opacity-[0.05] transition-opacity" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-90deg] text-[8px] font-black text-zinc-200 whitespace-nowrap tracking-[1em]">SWAP</div>
       </div>
    </div>
  ),

  "131. The Profile Ghost": ({ mode, setMode }) => (
    <div className="absolute top-6 left-6 z-50 flex items-center gap-3">
       <div className="w-8 h-8 rounded-full bg-zinc-50 border border-black/5 flex items-center justify-center overflow-hidden">
          <motion.div animate={{ rotate: mode === 'notes' ? 0 : 180 }} className="text-zinc-400">
             {mode === 'notes' ? <Fingerprint size={16}/> : <Cpu size={16}/>}
          </motion.div>
       </div>
       <button onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')} className="text-xs font-black uppercase tracking-tight text-zinc-300 hover:text-black transition-colors">
          Toggle {mode === 'notes' ? 'Intelligence' : 'Archive'}
       </button>
    </div>
  ),
};

// --- NEW 30 SCHEMES (301-330) ---

const NewSchemes: Record<string, React.FC<NavSchemeProps>> = {
  // 301. The Haptic Pull (侧边拉伸反馈)
  "301. Haptic Pull": ({ mode, setMode }) => (
    <div className="absolute left-64 top-1/2 -translate-y-1/2 z-50 translate-x-[-50%] group">
       <motion.div 
        whileHover={{ scaleY: 1.2, width: 4 }}
        onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}
        className="w-1 h-32 bg-zinc-100 rounded-full cursor-pointer flex items-center justify-center transition-all"
       >
          <div className={cn("w-1 h-8 rounded-full transition-colors", mode === 'notes' ? "bg-black" : "bg-purple-600")} />
       </motion.div>
    </div>
  ),

  // 302. The Kinetic Spring (物理弹簧胶囊)
  "302. Kinetic Spring": ({ mode, setMode }) => (
    <div className="absolute top-8 left-8 z-50">
       <div className="flex bg-zinc-50 border border-black/[0.02] rounded-full p-1 gap-1">
          {['notes', 'chat'].map(m => (
            <button 
              key={m}
              onClick={() => setMode(m as Mode)}
              className="relative px-6 py-1.5"
            >
               {mode === m && (
                 <motion.div 
                   layoutId="spring-bg"
                   transition={{ type: "spring", stiffness: 500, damping: 25 }}
                   className="absolute inset-0 bg-white shadow-sm rounded-full"
                 />
               )}
               <span className={cn("relative z-10 text-[10px] font-black uppercase tracking-widest transition-colors duration-500", mode === m ? "text-black" : "text-zinc-200")}>{m}</span>
            </button>
          ))}
       </div>
    </div>
  ),

  // 303. The Refractive Gutter (折射滑块)
  "303. Refractive Gutter": ({ mode, setMode }) => (
    <div className="absolute left-0 top-0 bottom-0 w-1 z-50">
       <div className="w-full h-full bg-zinc-50 relative overflow-hidden">
          <motion.div 
            animate={{ top: mode === 'notes' ? '0%' : '50%', height: '50%' }}
            className={cn("w-full transition-all duration-1000", mode === 'notes' ? "bg-black shadow-[0_0_20px_black]" : "bg-purple-600 shadow-[0_0_20px_purple]")}
          />
       </div>
       <div className="absolute inset-0 flex flex-col">
          <button onClick={() => setMode('notes')} className="flex-1" />
          <button onClick={() => setMode('chat')} className="flex-1" />
       </div>
    </div>
  ),

  // 304. The Adaptive Search Cap (Micro-Precision)
  "304. Search Precision": ({ mode, setMode }) => (
    <div className="absolute top-20 left-6 w-56 flex flex-col gap-1.5 group">
       <div className="h-8 bg-zinc-50 border border-black/[0.03] rounded-lg px-3 flex items-center">
          <Search size={12} className="text-zinc-300" />
          <div className="flex-1 ml-2 text-[11px] font-medium text-zinc-300">Quick Jump</div>
          <div className="flex gap-1">
             <button onClick={() => setMode('notes')} className={cn("w-4 h-4 rounded-md text-[8px] font-black transition-all", mode === 'notes' ? "bg-black text-white" : "bg-white border text-zinc-200")}>N</button>
             <button onClick={() => setMode('chat')} className={cn("w-4 h-4 rounded-md text-[8px] font-black transition-all", mode === 'chat' ? "bg-black text-white" : "bg-white border text-zinc-200")}>C</button>
          </div>
       </div>
    </div>
  ),

  // 305. The Magnetic Anchor (磁力锚点)
  "305. Magnetic Anchor": ({ mode, setMode }) => (
    <div className="absolute top-10 left-10 z-50">
       <motion.div 
        whileHover={{ scale: 1.1 }}
        onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}
        className="w-10 h-10 bg-white border border-black/[0.05] rounded-[1.2rem] shadow-lg flex items-center justify-center group cursor-pointer"
       >
          <div className="relative">
             <motion.div animate={{ scale: mode === 'notes' ? 1 : 0, opacity: mode === 'notes' ? 1 : 0 }} className="absolute inset-0 flex items-center justify-center text-black"><Anchor size={18}/></motion.div>
             <motion.div animate={{ scale: mode === 'chat' ? 1 : 0, opacity: mode === 'chat' ? 1 : 0 }} className="absolute inset-0 flex items-center justify-center text-purple-600"><Engine size={18}/></motion.div>
             <div className="w-[18px] h-[18px]" /> {/* Spacer */}
          </div>
       </motion.div>
    </div>
  ),

  // 306. The Minimalist Spine (Text Scroll)
  "306. Spine Scroll": ({ mode, setMode }) => (
    <div className="absolute left-0 top-0 bottom-0 w-8 z-50 flex items-center justify-center border-r border-black/[0.02] overflow-hidden">
       <div className="flex flex-col gap-32 items-center">
          <button onClick={() => setMode('notes')} className={cn("rotate-[-90deg] text-[9px] font-black tracking-[0.5em] transition-all", mode === 'notes' ? "text-black translate-x-1" : "text-zinc-50 opacity-20")}>RECORDS</button>
          <button onClick={() => setMode('chat')} className={cn("rotate-[-90deg] text-[9px] font-black tracking-[0.5em] transition-all", mode === 'chat' ? "text-black translate-x-1" : "text-zinc-50 opacity-20")}>NEURAL</button>
       </div>
    </div>
  ),

  // 307. The Fluid Breadcrumb (Gap-less)
  "307. Path Transition": ({ mode, setMode }) => (
    <div className="absolute top-6 left-8 z-50 flex items-center gap-1 bg-zinc-50/50 p-0.5 rounded-lg border border-black/[0.02]">
       <button onClick={() => setMode('notes')} className={cn("px-4 py-1 rounded-md text-[10px] font-black uppercase transition-all", mode === 'notes' ? "bg-white text-black shadow-sm" : "text-zinc-200")}>Vault</button>
       <div className="w-4 h-[1px] bg-zinc-100" />
       <button onClick={() => setMode('chat')} className={cn("px-4 py-1 rounded-md text-[10px] font-black uppercase transition-all", mode === 'chat' ? "bg-white text-black shadow-sm" : "text-zinc-200")}>Core</button>
    </div>
  ),

  // 308. The Floating Eye (Focus metaphor)
  "308. Focus Eye": ({ mode, setMode }) => (
    <div className="absolute top-8 right-8 z-50">
       <button 
        onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}
        className="group relative w-8 h-8 flex items-center justify-center"
       >
          <div className="absolute inset-0 border border-zinc-100 rounded-full group-hover:border-black transition-all duration-700" />
          <motion.div animate={{ rotate: mode === 'notes' ? 0 : 180 }} className="text-zinc-300 group-hover:text-black">
             <Eye size={14} />
          </motion.div>
       </button>
    </div>
  ),

  // 309. The Sidebar Notch (Refined)
  "309. Sidebar Key": ({ mode, setMode }) => (
    <div className="absolute left-64 top-1/2 -translate-y-1/2 z-50 translate-x-[-100%] pr-2">
       <div className="bg-white border border-black/[0.05] rounded-l-xl p-1 flex flex-col gap-6 shadow-sm">
          <button onClick={() => setMode('notes')} className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", mode === 'notes' ? "bg-zinc-950 text-white shadow-lg" : "text-zinc-200")}><Layers size={16}/></button>
          <button onClick={() => setMode('chat')} className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", mode === 'chat' ? "bg-zinc-950 text-white shadow-lg" : "text-zinc-200")}><Cpu size={16}/></button>
       </div>
    </div>
  ),

  // 310. The Ghost Bar (Top of Workspace)
  "310. Header Trace": ({ mode, setMode }) => (
    <div className="absolute top-0 left-64 right-0 h-1 z-50 flex opacity-20 group-hover:opacity-100 transition-opacity">
       <div onClick={() => setMode('notes')} className={cn("flex-1 cursor-pointer transition-all duration-1000", mode === 'notes' ? "bg-black" : "bg-zinc-50")} />
       <div onClick={() => setMode('chat')} className={cn("flex-1 cursor-pointer transition-all duration-1000", mode === 'chat' ? "bg-purple-600 shadow-[0_0_15px_purple]" : "bg-zinc-50")} />
    </div>
  ),

  "311. The Kinetic Dial (Integrated)": ({ mode, setMode }) => (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
       <div className="flex gap-1.5 items-center group cursor-pointer" onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}>
          <div className="text-[9px] font-black tracking-widest text-zinc-200 group-hover:text-black">NOTES</div>
          <div className="w-12 h-0.5 bg-zinc-100 relative">
             <motion.div animate={{ left: mode === 'notes' ? '0%' : '100%' }} className="absolute top-[-3px] w-2 h-2 bg-black rounded-full -translate-x-1/2" />
          </div>
          <div className="text-[9px] font-black tracking-widest text-zinc-200 group-hover:text-black">CHAT</div>
       </div>
    </div>
  ),

  "312. The Sidebar Ribbon (Text Scale)": ({ mode, setMode }) => (
    <div className="absolute top-32 left-0 z-50 flex flex-col gap-12 w-8 items-center border-r border-black/[0.02]">
       <button onClick={() => setMode('notes')} className={cn("rotate-[-90deg] text-[8px] font-black uppercase tracking-[0.5em] transition-all", mode === 'notes' ? "text-black scale-125" : "text-zinc-50")}>Archive</button>
       <button onClick={() => setMode('chat')} className={cn("rotate-[-90deg] text-[8px] font-black uppercase tracking-[0.5em] transition-all", mode === 'chat' ? "text-black scale-125" : "text-zinc-50")}>Neural</button>
    </div>
  ),

  "313. The Floating Capsule (Refractive)": ({ mode, setMode }) => (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
       <div className="bg-white/80 backdrop-blur-xl border border-black/[0.05] rounded-full p-1 flex gap-8 items-center px-6 shadow-2xl">
          <button onClick={() => setMode('notes')} className={cn("text-[10px] font-black uppercase transition-all", mode === 'notes' ? "text-black" : "text-zinc-200")}>Records</button>
          <div className="w-1 h-1 bg-zinc-100 rounded-full" />
          <button onClick={() => setMode('chat')} className={cn("text-[10px] font-black uppercase transition-all", mode === 'chat' ? "text-black" : "text-zinc-200")}>Agent</button>
       </div>
    </div>
  ),

  "314. The Workspace Morph (Minimal Logo)": ({ mode, setMode }) => (
    <div className="absolute top-6 left-6 z-50 flex items-center gap-4 cursor-pointer group" onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}>
       <div className="w-10 h-10 bg-zinc-950 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all group-hover:scale-110">
          <motion.div animate={{ rotate: mode === 'notes' ? 0 : 90 }}>
             {mode === 'notes' ? <Layers size={20}/> : <Cpu size={20} className="text-purple-400"/>}
          </motion.div>
       </div>
       <div className="flex flex-col">
          <span className="text-xs font-black tracking-widest text-black">vlaina NT</span>
          <span className="text-[8px] font-bold text-zinc-300 uppercase italic">Environment::{mode}</span>
       </div>
    </div>
  ),

  "315. The Sidebar Bottom Dial": ({ mode, setMode }) => (
    <div className="absolute bottom-6 left-6 w-56 z-50 flex justify-between items-center border-t border-black/[0.03] pt-4">
       <div className="flex gap-4">
          <button onClick={() => setMode('notes')} className={cn("text-[9px] font-black uppercase tracking-widest", mode === 'notes' ? "text-black" : "text-zinc-100")}>Docs</button>
          <button onClick={() => setMode('chat')} className={cn("text-[9px] font-black uppercase tracking-widest", mode === 'chat' ? "text-black" : "text-zinc-100")}>Core</button>
       </div>
       <div className="w-8 h-px bg-zinc-100 relative overflow-hidden">
          <motion.div animate={{ left: mode === 'notes' ? '-100%' : '0%' }} className="absolute inset-0 w-full h-full bg-black" />
       </div>
    </div>
  ),

  "316. The Floating Command (Micro-Vertical)": ({ mode, setMode }) => (
    <div className="absolute top-1/2 -translate-y-1/2 left-8 z-50 flex flex-col gap-2">
       <button onClick={() => setMode('notes')} className={cn("w-1 h-8 rounded-full transition-all duration-700", mode === 'notes' ? "bg-black scale-x-[3] shadow-lg" : "bg-zinc-50")} />
       <button onClick={() => setMode('chat')} className={cn("w-1 h-8 rounded-full transition-all duration-700", mode === 'chat' ? "bg-black scale-x-[3] shadow-lg" : "bg-zinc-50")} />
    </div>
  ),

  "317. The Breadcrumb Status (Glow Dot)": ({ mode, setMode }) => (
    <div className="absolute top-6 left-8 z-50 flex items-center gap-3">
       <span className="text-xs font-bold text-zinc-300 tracking-tighter italic">vlaina_Core</span>
       <div className="w-[1px] h-3 bg-zinc-100" />
       <button onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')} className="group flex items-center gap-2">
          <div className={cn("w-1.5 h-1.5 rounded-full", mode === 'notes' ? "bg-black shadow-[0_0_10px_black]" : "bg-purple-600 shadow-[0_0_10px_purple] animate-pulse")} />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-black transition-colors">{mode}</span>
       </button>
    </div>
  ),

  "318. The Sidebar Notch (Top-Center of Sidebar)": ({ mode, setMode }) => (
    <div className="absolute top-0 left-0 w-64 h-10 z-50 flex items-center justify-center">
       <div className="bg-zinc-50 rounded-b-2xl border-x border-b border-black/[0.03] px-6 py-1.5 flex gap-10">
          <button onClick={() => setMode('notes')} className={cn("text-[9px] font-black transition-all", mode === 'notes' ? "text-black scale-110" : "text-zinc-200")}><Layers size={14}/></button>
          <button onClick={() => setMode('chat')} className={cn("text-[9px] font-black transition-all", mode === 'chat' ? "text-black scale-110" : "text-zinc-200")}><Power size={14}/></button>
       </div>
    </div>
  ),

  "319. The Floating Wing (Bottom-Left Inset)": ({ mode, setMode }) => (
    <div className="absolute bottom-0 left-0 z-50 bg-zinc-950 text-white rounded-tr-[2.5rem] px-8 py-4 flex items-center gap-6 shadow-2xl">
       <button onClick={() => setMode('notes')} className={cn("text-[9px] font-black uppercase tracking-widest transition-all", mode === 'notes' ? "opacity-100 translate-y-[-2px]" : "opacity-20")}>Records</button>
       <button onClick={() => setMode('chat')} className={cn("text-[9px] font-black uppercase tracking-widest transition-all", mode === 'chat' ? "opacity-100 translate-y-[-2px]" : "opacity-20")}>Neural</button>
    </div>
  ),

  "320. The Zero-Space Transition (Top)": ({ mode, setMode }) => (
    <div className="absolute inset-x-0 top-0 h-10 z-50 pointer-events-none group">
       <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-b from-black/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto cursor-pointer flex items-center justify-center" onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}>
          <div className="flex gap-20">
             <div className={cn("w-1 h-1 rounded-full", mode === 'notes' ? "bg-black scale-[2]" : "bg-zinc-100")} />
             <div className={cn("w-1 h-1 rounded-full", mode === 'chat' ? "bg-black scale-[2]" : "bg-zinc-100")} />
          </div>
       </div>
    </div>
  ),

  "321. The Kinetic Gutter Hook": ({ mode, setMode }) => (
    <div className="absolute left-64 top-32 z-50 translate-x-[-50%]">
       <div 
        onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}
        className="w-10 h-10 bg-white border border-black/5 rounded-2xl flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all group cursor-pointer"
       >
          <motion.div animate={{ rotate: mode === 'notes' ? 0 : 180 }} className="text-zinc-300 group-hover:text-black">
             <Spline size={20} />
          </motion.div>
       </div>
    </div>
  ),

  "322. The Adaptive Path (Sidebar Head)": ({ mode, setMode }) => (
    <div className="absolute top-6 left-6 z-50 flex flex-col gap-1.5">
       <span className="text-[10px] font-black uppercase tracking-widest text-zinc-200">System_Root</span>
       <button 
        onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}
        className="text-sm font-black text-black underline decoration-zinc-100 underline-offset-4 hover:decoration-purple-200 transition-all text-left"
       >
          {mode === 'notes' ? 'Knowledge_Vault' : 'Neural_Engine'}
       </button>
    </div>
  ),

  "323. The Floating Capsule (Refractive Edge)": ({ mode, setMode }) => (
    <div className="absolute top-8 right-8 z-50 bg-white/20 backdrop-blur-2xl border border-white/30 rounded-2xl p-1 flex flex-col gap-1 shadow-2xl">
       <button onClick={() => setMode('notes')} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", mode === 'notes' ? "bg-white text-black shadow-lg scale-110" : "text-white/40")}><FileText size={20}/></button>
       <button onClick={() => setMode('chat')} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", mode === 'chat' ? "bg-white text-black shadow-lg scale-110" : "text-white/40")}><Engine size={20}/></button>
    </div>
  ),

  "324. The Geometric Dial (Bottom)": ({ mode, setMode }) => (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex gap-4 items-center group cursor-pointer" onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}>
       <div className={cn("w-1 h-1 rounded-full transition-all duration-700", mode === 'notes' ? "bg-black scale-150" : "bg-zinc-100")} />
       <div className="text-[8px] font-black uppercase tracking-[1em] text-zinc-200 group-hover:text-black">TRANSITION</div>
       <div className={cn("w-1 h-1 rounded-full transition-all duration-700", mode === 'chat' ? "bg-black scale-150" : "bg-zinc-100")} />
    </div>
  ),

  "325. The Sidebar Ribbon (Ghost)": ({ mode, setMode }) => (
    <div className="absolute top-1/2 -translate-y-1/2 left-0 z-50">
       <div className="bg-zinc-950 text-white rounded-r-2xl py-8 px-1.5 flex flex-col gap-12 shadow-2xl">
          <button onClick={() => setMode('notes')} className={cn("transition-all duration-700", mode === 'notes' ? "scale-150 text-purple-400" : "opacity-20")}><Hash size={16}/></button>
          <button onClick={() => setMode('chat')} className={cn("transition-all duration-700", mode === 'chat' ? "scale-150 text-purple-400" : "opacity-20")}><Radio size={16}/></button>
       </div>
    </div>
  ),

  "326. The Minimalist Gutter (Subtle Line)": ({ mode, setMode }) => (
    <div className="absolute left-64 top-0 bottom-0 w-px bg-zinc-50 z-50 group">
       <div className="w-full h-full relative">
          <motion.div 
            animate={{ top: mode === 'notes' ? '0%' : '50%', height: '50%' }}
            className="absolute inset-x-0 bg-black opacity-10 group-hover:opacity-100 transition-opacity" 
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer flex flex-col gap-1">
             <button onClick={() => setMode('notes')} className="w-4 h-4 rounded-full border border-black/5 bg-white shadow-sm flex items-center justify-center"><div className={cn("w-1 h-1 rounded-full bg-black", mode === 'notes' ? "opacity-100" : "opacity-10")} /></button>
             <button onClick={() => setMode('chat')} className="w-4 h-4 rounded-full border border-black/5 bg-white shadow-sm flex items-center justify-center"><div className={cn("w-1 h-1 rounded-full bg-black", mode === 'chat' ? "opacity-100" : "opacity-10")} /></button>
          </div>
       </div>
    </div>
  ),

  "327. The Floating Seed (Top-Right Micro)": ({ mode, setMode }) => (
    <div className="absolute top-10 right-10 z-50">
       <button 
        onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}
        className="w-6 h-6 bg-zinc-50 border border-black/[0.03] rounded-lg flex items-center justify-center shadow-sm hover:scale-110 active:scale-95 transition-all text-zinc-300 hover:text-black"
       >
          <Magnet size={14} />
       </button>
    </div>
  ),

  "328. The Adaptive Path (Breadcrumb Drop)": ({ mode, setMode }) => (
    <div className="absolute top-6 left-8 z-50 flex items-center gap-3">
       <span className="text-xs font-bold text-zinc-300 uppercase tracking-tighter">PROJECT::ALPHA</span>
       <ChevronRight size={12} className="text-zinc-200" />
       <div className="relative group cursor-pointer" onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}>
          <span className="text-xs font-black uppercase text-purple-600 underline decoration-purple-100 underline-offset-4">{mode}</span>
          <div className="absolute bottom-[-20px] left-0 right-0 h-10 bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-xl rounded-b-xl border border-black/[0.03] flex items-center justify-center pointer-events-none">
             <span className="text-[8px] font-black text-zinc-300 uppercase tracking-widest">Toggle Context</span>
          </div>
       </div>
    </div>
  ),

  "329. The Corner Notch (Realistic Fold)": ({ mode, setMode }) => (
    <div className="absolute top-0 left-64 z-50">
       <div 
        onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}
        className="w-20 h-20 bg-[#fafafb] border-r border-b border-black/[0.02] rounded-br-[4rem] flex items-center justify-center group cursor-pointer hover:bg-zinc-100 transition-all"
       >
          <div className="text-zinc-200 group-hover:text-black transition-colors rotate-45">
             {mode === 'notes' ? <FileText size={24}/> : <Radio size={24}/>}
          </div>
       </div>
    </div>
  ),

  "330. Absolute Singularity (Final)": ({ mode, setMode }) => (
    <div className="absolute inset-0 z-50 pointer-events-none group">
       <div className="absolute inset-0 flex items-center justify-center pointer-events-auto cursor-pointer" onClick={() => setMode(mode === 'notes' ? 'chat' : 'notes')}>
          <div className={cn("w-1 h-1 rounded-full transition-all duration-1000", mode === 'notes' ? "bg-black scale-100" : "bg-purple-600 scale-150 shadow-[0_0_30px_purple]")} />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-[2em] text-zinc-100 opacity-0 group-hover:opacity-100 transition-all duration-1000">
             SINGULARITY_ROOT
          </div>
       </div>
    </div>
  )
};

export function CoreNavigationLab() {
  const [selectedScheme, setSelectedScheme] = useState<string>(Object.keys(ReservedSchemes)[0]);
  const [mode, setMode] = useState<Mode>('notes');

  const ActiveScheme = ReservedSchemes[selectedScheme] || NewSchemes[selectedScheme];

  return (
    <div className="min-h-screen bg-[#f8f8f9] dark:bg-[#050505] flex flex-col font-sans">
      {/* Sidebar Selection */}
      <div className="fixed top-24 left-8 w-64 bottom-8 overflow-y-auto pr-4 z-[100] hidden xl:block custom-scrollbar">
        <div className="flex flex-col gap-10">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] mb-6 text-purple-600 italic underline decoration-purple-200 underline-offset-8">The Masterpiece Reserved</h2>
            <div className="flex flex-col gap-2">
              {Object.keys(ReservedSchemes).map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedScheme(name)}
                  className={cn(
                    "w-full text-left px-5 py-3 rounded-2xl text-[12px] font-bold transition-all flex items-center justify-between group",
                    selectedScheme === name 
                      ? "bg-black text-white shadow-2xl translate-x-1 scale-[1.02]" 
                      : "bg-white dark:bg-zinc-800 text-zinc-400 border border-black/5 hover:bg-zinc-50"
                  )}
                >
                  {name.includes('. ') ? name.split('. ')[1] : name}
                  <ChevronRight size={14} className={cn("transition-all", selectedScheme === name ? "opacity-100" : "opacity-0")} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] mb-6 text-zinc-400">Gen-11: Sensory Precision</h2>
            <div className="flex flex-col gap-1.5 pb-20">
              {Object.keys(NewSchemes).map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedScheme(name)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all flex items-center justify-between group",
                    selectedScheme === name 
                      ? "bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white" 
                      : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black opacity-20">{name.split('. ')[0]}</span>
                    {name.split('. ')[1]}
                  </div>
                  <ChevronRight size={12} className={cn("transition-all", selectedScheme === name ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2")} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Preview Canvas */}
      <div className="flex-1 flex items-center justify-center p-8 xl:pl-[340px]">
        <div className="flex flex-col gap-10 w-full max-w-5xl">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-2xl border border-white/10 scale-110">
                   <Engine size={20} className="animate-pulse" />
                </div>
                <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase italic">Sensory Precision<span className="text-purple-600">.</span></h1>
             </div>
             <p className="text-zinc-400 font-medium text-lg ml-14">Refining the haptic nature of digital transitions. 30 precision interaction metaphors.</p>
          </div>

          {/* Mock App Container */}
          <div className="relative aspect-[16/10] bg-white dark:bg-[#0a0a0a] rounded-[3.5rem] shadow-[0_120px_240px_-60px_rgba(0,0,0,0.25)] border border-black/[0.01] overflow-hidden group select-none">
            
            {/* The Switch Component Being Tested */}
            {ActiveScheme && <ActiveScheme mode={mode} setMode={setMode} />}

            {/* Mock Content Container */}
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 2, filter: 'blur(20px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -2, filter: 'blur(20px)' }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-full flex"
              >
                {mode === 'notes' ? (
                  <div className="flex-1 flex">
                    <div className="w-64 border-r border-black/[0.01] dark:border-white/[0.01] p-8 flex flex-col pt-32 bg-zinc-50/5">
                       <div className="space-y-6">
                          {[1,2,3,4,5,6,7,8].map(i => (
                            <div key={i} className="flex items-center gap-3 group/item">
                               <div className="w-4 h-4 bg-zinc-100 dark:bg-zinc-800 rounded shadow-sm group-hover/item:bg-zinc-200 transition-colors" />
                               <div className="h-1.5 flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                            </div>
                          ))}
                       </div>
                    </div>
                    <div className="flex-1 p-20 pt-32">
                       <div className="h-12 w-96 bg-zinc-50 dark:bg-zinc-800 rounded-2xl mb-12 shadow-sm border border-black/[0.01]" />
                       <div className="space-y-8">
                          {[1,2,3].map(i => <div key={i} className="h-4 w-full bg-zinc-50/80 dark:bg-zinc-800/50 rounded-full" />)}
                          <div className="h-48 w-full bg-zinc-50/10 rounded-[4rem] mt-16 border border-black/[0.01] shadow-inner" />
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col p-20 pt-32 items-center justify-end">
                     <div className="w-full max-w-xl space-y-12 mb-24">
                        <div className="flex justify-end">
                           <div className="bg-zinc-950 text-white px-8 py-5 rounded-[2.5rem] rounded-br-lg text-[15px] font-medium max-w-[85%] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)]">
                              Neural precision established. Environment fully calibrated for synthesis.
                           </div>
                        </div>
                        <div className="flex justify-start">
                           <div className="bg-zinc-50 dark:bg-zinc-800 px-8 py-5 rounded-[2.5rem] rounded-bl-lg text-[15px] font-medium max-w-[85%] border border-black/5 shadow-sm">
                              Evaluate the "Haptic Visuals" concept across the latest 330 schemes.
                           </div>
                        </div>
                     </div>
                     <div className="w-full max-w-xl h-16 bg-white dark:bg-zinc-800 border border-black/[0.05] rounded-full flex items-center px-8 shadow-2xl">
                        <span className="text-zinc-200 text-[15px] font-medium italic tracking-tighter">Streaming neural core...</span>
                        <div className="ml-auto w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center border border-purple-100">
                           <Atom size={18} className="text-purple-600 animate-spin [animation-duration:4s]" />
                        </div>
                     </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Detailed Info Footer */}
          <div className="flex justify-between items-end text-zinc-400">
             <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-200 italic">Director's Manifest v11.0</span>
                <div className="flex items-center gap-4">
                   <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">Haptic Visuals</div>
                   <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">Spring Physics</div>
                   <div className="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg text-[9px] font-bold uppercase italic underline decoration-purple-200 underline-offset-4">330 Schemes Reached</div>
                </div>
             </div>
             <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-black text-zinc-900 dark:text-white tracking-tighter uppercase italic">{selectedScheme}</span>
                <span className="text-[10px] font-bold text-zinc-300">vlaina Navigation Authority MILESTONE_330</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
