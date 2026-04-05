import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export interface SearchVariantProps {
  query: string;
  setQuery: (q: string) => void;
  replaceValue: string;
  setReplaceValue: (v: string) => void;
  isReplaceOpen: boolean;
  toggleReplace: () => void;
  activeMatch: number;
  totalMatches: number;
  onNext: () => void;
  onPrev: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

interface IconButtonProps {
  icon: IconName;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  className?: string;
}

const IconButton = ({ icon, onClick, active, className }: IconButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      "p-1.5 rounded-md transition-all active:scale-95",
      active ? "text-blue-500 bg-blue-500/10" : "text-zinc-500 hover:bg-zinc-500/10",
      className
    )}
  >
    <Icon name={icon} size="sm" />
  </button>
);

// --- RESERVED AREA: THE FAVORITES ---

/** 0. Spotlight Pro (The Master) */
export const SpotlightPro = (props: SearchVariantProps) => (
  <motion.div initial={{ scale: 0.95, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="w-[480px] bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border-none overflow-hidden p-3">
    <div className="flex items-center gap-3">
      <Icon name="common.search" className="text-zinc-400 ml-2" size="md" />
      <input autoFocus value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="Spotlight Find" className="flex-1 bg-transparent border-none outline-none text-xl font-light text-zinc-900 dark:text-zinc-100" />
      <div className="flex items-center gap-1 border-l border-zinc-100 dark:border-zinc-800 pl-2">
        <IconButton icon="nav.chevronUp" onClick={props.onPrev} />
        <IconButton icon="nav.chevronDown" onClick={props.onNext} />
        <IconButton icon="common.close" onClick={props.onClose} />
      </div>
    </div>
  </motion.div>
);

/** 1. Pearl: Soft white iridescent glow. */
export const SpotlightPearl = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-white/90 backdrop-blur-xl rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.05),inset_0_0_10px_white] p-2 flex items-center px-6 gap-3 border border-white/50">
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-zinc-800 placeholder:text-zinc-300 font-medium" placeholder="Pearl White" />
    <IconButton icon="common.close" onClick={props.onClose} className="opacity-40" />
  </div>
);

/** 2. Glass Max: Extreme 64px backdrop blur. */
export const SpotlightGlassMax = (props: SearchVariantProps) => (
  <div className="w-[480px] backdrop-blur-[64px] bg-white/30 dark:bg-black/30 rounded-3xl p-4 flex items-center px-8 shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-white/20">
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-xl font-light tracking-wide text-zinc-900 dark:text-zinc-100" placeholder="Ethereal Search" />
  </div>
);

/** 3. Pulse: Breathing shadow animation. */
export const SpotlightPulse = (props: SearchVariantProps) => (
  <motion.div animate={props.query ? { boxShadow: ["0 0 0px rgba(59,130,246,0)", "0 0 20px rgba(59,130,246,0.2)", "0 0 0px rgba(59,130,246,0)"] } : {}} transition={{ repeat: Infinity, duration: 2 }} className="w-[480px] bg-white dark:bg-zinc-900 rounded-3xl p-4 shadow-xl flex items-center gap-4">
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none font-medium" placeholder="Breathing Pulse" />
  </motion.div>
);

// --- THE NEW 30 EVOLUTIONS ---

/** 4. Zen (Washi): Hand-made paper texture. */
export const SpotlightZen = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-[#faf9f6] p-6 shadow-sm border border-[#e8e4db] relative overflow-hidden group">
    <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]" />
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none font-serif text-xl italic text-[#4a4843]" placeholder="Washi Zen Find..." />
  </div>
);

/** 5. Obsidian Zen: Ultra-matte black stone. */
export const SpotlightObsidianZen = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-black rounded-sm shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-5 border border-white/5 flex flex-col gap-2">
    <span className="text-[9px] text-zinc-800 font-bold uppercase tracking-[0.4em]">Absolute Void</span>
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="bg-transparent outline-none text-zinc-100 text-lg font-light tracking-wider" placeholder="Search Obsidian..." />
  </div>
);

/** 6. Carbon Fiber: High-tech woven pattern. */
export const SpotlightCarbon = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-[#111] rounded-xl p-4 shadow-2xl border border-white/10 relative">
    <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
    <div className="relative flex items-center gap-4">
       <div className="w-1.5 h-6 bg-red-600 rounded-full" />
       <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-white font-mono" placeholder="CARBON_LINK_ACTIVE" />
    </div>
  </div>
);

/** 7. Liquid Gold: Shifting molten metal. */
export const SpotlightLiquidGold = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-gradient-to-br from-amber-200 via-yellow-500 to-amber-900 rounded-2xl p-[1.5px] shadow-2xl">
    <div className="bg-black/95 rounded-[15px] p-4 flex items-center gap-3">
       <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-amber-200 placeholder:text-amber-900/50 font-bold" placeholder="Melting Metal Search" />
    </div>
  </div>
);

/** 8. Slate Stone: Rough textured block. */
export const SpotlightSlate = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-zinc-800 rounded shadow-[inset_0_2px_10px_rgba(0,0,0,0.5),10px_10px_30px_rgba(0,0,0,0.2)] p-6 border-b-4 border-zinc-950">
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-zinc-200 text-2xl font-black italic tracking-tighter" placeholder="SLATE_FIND" />
  </div>
);

/** 9. Etched Glass: Visible via frosted edges. */
export const SpotlightEtched = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-white/5 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white/10 hover:border-white/40 transition-colors">
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-white text-center font-thin italic text-2xl" placeholder="Etched in Glass" />
  </div>
);

/** 10. Magnetic Flux: Elastic distortion. */
export const SpotlightMagneticFlux = (props: SearchVariantProps) => {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  return (
    <motion.div animate={{ rotateX: -coords.y, rotateY: coords.x }} onMouseMove={(e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setCoords({ x: (e.clientX - rect.left - rect.width/2)/5, y: (e.clientY - rect.top - rect.height/2)/5 });
    }} onMouseLeave={() => setCoords({x:0, y:0})} className="w-[480px] bg-zinc-900 rounded-[40px] p-8 shadow-[0_50px_100px_rgba(0,0,0,0.5)] cursor-none">
       <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-white text-3xl font-black italic" placeholder="Magnetic Pull" />
    </motion.div>
  );
};

/** 11. Glitch Core: Digital flickering. */
export const SpotlightGlitch = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-black rounded p-4 shadow-[0_0_20px_rgba(0,255,255,0.1)] border-l-2 border-cyan-500 overflow-hidden relative group">
    <motion.div animate={props.query ? { x: [-1, 1, -1] } : {}} transition={{ repeat: Infinity, duration: 0.1 }} className="flex items-center gap-4">
       <span className="text-cyan-500 font-mono text-xs">FIND_ERR:</span>
       <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-white font-mono text-sm" placeholder="0xSEARCH_INIT" />
    </motion.div>
  </div>
);

/** 12. Bio-Organic: Soft breathing edges. */
export const SpotlightBio = (props: SearchVariantProps) => (
  <motion.div animate={{ borderRadius: ["40px 40px 40px 40px", "60px 20px 60px 20px", "40px 40px 40px 40px"] }} transition={{ repeat: Infinity, duration: 4 }} className="w-[480px] bg-white dark:bg-zinc-900 p-8 shadow-2xl flex items-center justify-center border border-zinc-100 dark:border-zinc-800">
     <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-center text-xl font-medium" placeholder="Organic Search" />
  </motion.div>
);

/** 13. Accordion: Horizontal expansion. */
export const SpotlightAccordion = (props: SearchVariantProps) => (
  <motion.div layout animate={{ width: props.query ? 600 : 400 }} className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-4 flex items-center shadow-xl border border-black/5">
     <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none font-black uppercase text-sm tracking-[0.2em]" placeholder="Type to Expand" />
  </motion.div>
);

/** 14. Shadow-Focus: Pure definition by shadow. */
export const SpotlightShadowFocus = (props: SearchVariantProps) => (
  <div className={cn("w-[480px] rounded-2xl p-4 transition-all duration-1000", props.query ? "bg-white dark:bg-zinc-900 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]" : "bg-transparent shadow-none")}>
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-center text-2xl font-thin italic" placeholder="Defined by Shadow" />
  </div>
);

/** 15. Bouncy Bubble: Round ends. */
export const SpotlightBubble = (props: SearchVariantProps) => (
  <motion.div whileTap={{ scale: 0.9 }} className="w-[480px] h-20 bg-blue-500 rounded-full flex items-center px-10 shadow-[0_20px_40px_rgba(59,130,246,0.3)] border-b-8 border-blue-700">
     <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-white text-2xl font-black placeholder:text-blue-200" placeholder="Bouncy Find" />
  </motion.div>
);

/** 16. Prism Dispersion: Advanced light diffraction. */
export const SpotlightPrismV2 = (props: SearchVariantProps) => (
  <div className="w-[480px] relative p-[3px] rounded-2xl overflow-hidden shadow-2xl">
     <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-green-500 to-blue-500 blur-md opacity-40 animate-pulse" />
     <div className="relative bg-white dark:bg-zinc-950 rounded-2xl p-5 flex items-center border border-white/20 backdrop-blur-3xl">
        <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-xl font-bold tracking-tight" placeholder="Chromatic Prism" />
     </div>
  </div>
);

/** 17. Luminous Text: No container. */
export const SpotlightLuminous = (props: SearchVariantProps) => (
  <div className="w-[480px] flex items-center justify-center py-10">
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-center text-6xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" placeholder="LUMINOUS" />
  </div>
);

/** 18. Silhouette: Pure contrast. */
export const SpotlightSilhouette = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-black rounded-none border-[1px] border-white p-6 shadow-[20px_20px_0_white]">
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-white font-mono text-xl tracking-widest uppercase" placeholder="SILHOUETTE_SEARCH" />
  </div>
);

/** 19. Neon Glow: Thin vibrant tubes. */
export const SpotlightNeon = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-zinc-950 rounded-full p-4 border border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.5),inset_0_0_15px_rgba(59,130,246,0.2)]">
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-blue-100 text-center font-bold tracking-widest" placeholder="NEON_PULSE" />
  </div>
);

/** 20. Holographic: Shifting color mesh. */
export const SpotlightHolograph = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-zinc-900 rounded-3xl p-6 relative overflow-hidden shadow-2xl group">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,255,0.2),transparent)] opacity-50 group-hover:scale-150 transition-transform duration-1000" />
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="relative w-full bg-transparent outline-none text-cyan-100 text-2xl font-thin tracking-[0.2em]" placeholder="Holographic Search" />
  </div>
);

/** 21. Interactive Blur v2: Mapped intensity. */
export const SpotlightBlurV2 = (props: SearchVariantProps) => (
  <div className="w-[480px] relative rounded-full p-1 border border-white/5 shadow-2xl overflow-hidden">
     <div className="absolute inset-0 backdrop-blur-3xl bg-white/10" style={{ backdropFilter: `blur(${props.query.length * 2}px)` }} />
     <div className="relative p-4 px-8 flex items-center">
        <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-xl font-light italic" placeholder="Blur Intensity Morph" />
     </div>
  </div>
);

/** 22. Side-Kick: Detached result bubble. */
export const SpotlightSideKick = (props: SearchVariantProps) => (
  <div className="flex items-end gap-2">
    <div className="w-[380px] bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-xl border border-zinc-100 dark:border-zinc-800">
      <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none font-medium" placeholder="Side-Kick Find" />
    </div>
    <AnimatePresence>
      {props.query && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-zinc-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest mb-1 shadow-lg border border-white/10">
          Res: {props.activeMatch}/{props.totalMatches}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

/** 23. Timeline Trace: History trail. */
export const SpotlightTimeline = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-2 shadow-inner">
     <div className="flex items-center gap-4 p-3 bg-white dark:bg-zinc-900 rounded-xl mb-1 shadow-sm">
        <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none" placeholder="Timeline Trace" />
     </div>
     <div className="px-4 py-1 flex gap-4 text-[9px] font-bold text-zinc-400 uppercase tracking-widest opacity-50">
        <span>Recent: system</span>
        <span>arch</span>
        <span>flux</span>
     </div>
  </div>
);

/** 24. Sticker: Physical peel feel. */
export const SpotlightSticker = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-[#fff] p-8 shadow-[10px_10px_20px_rgba(0,0,0,0.1)] relative border-b-2 border-r-2 border-zinc-200">
    <div className="absolute top-0 right-0 w-8 h-8 bg-zinc-100 border-l border-b border-zinc-300 shadow-sm origin-top-right rotate-0" />
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-black font-serif italic text-3xl" placeholder="Sticker Note" />
  </div>
);

/** 25. Wide-Span: Extreme horizontal. */
export const SpotlightWideSpan = (props: SearchVariantProps) => (
  <div className="w-[720px] h-10 border-b border-zinc-900 dark:border-white flex items-center px-4 gap-8">
    <span className="text-[10px] font-black uppercase tracking-[0.5em]">SYSTEM_WIDE_SEARCH</span>
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-sm font-medium tracking-tight" placeholder="Execute Query..." />
  </div>
);

/** 26. Compact Mono: Dense power user. */
export const SpotlightCompact = (props: SearchVariantProps) => (
  <div className="w-[400px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 h-8 flex items-center px-2 gap-2 text-[10px] font-mono shadow-sm">
    <div className="w-4 h-4 bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black font-bold">/</div>
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none" placeholder="vim.find(regex)" />
  </div>
);

/** 27. Pinstripe Retro: 80s Apple style. */
export const SpotlightRetroPinstripe = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-[#ccc] p-1 border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#666] shadow-[2px_2px_0_black]">
    <div className="bg-[#999] h-6 flex items-center justify-center gap-1 mb-1 bg-[repeating-linear-gradient(90deg,#888,#888_2px,transparent_2px,transparent_4px)]">
       <span className="bg-[#ccc] px-4 text-[9px] font-bold uppercase tracking-widest text-black border border-[#666]">Search</span>
    </div>
    <div className="bg-white border-t-2 border-l-2 border-[#666] p-2">
       <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none font-mono text-xs text-black" placeholder="PLATINUM_FIND" />
    </div>
  </div>
);

/** 28. The Void: Cut into the UI. */
export const SpotlightVoid = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-zinc-200 dark:bg-black p-10 rounded-[40px] shadow-[inset_0_10px_30px_rgba(0,0,0,0.8)] border border-white/5">
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-center text-3xl font-thin tracking-[0.3em] text-white" placeholder="INTO_THE_VOID" />
  </div>
);

/** 29. Cloud Mesh: Shifting gradients. */
export const SpotlightCloud = (props: SearchVariantProps) => (
  <div className="w-[480px] h-20 rounded-3xl overflow-hidden relative shadow-2xl border border-white/10">
    <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 via-pink-500 to-blue-500 opacity-20 animate-pulse" />
    <div className="relative h-full flex items-center px-8 backdrop-blur-sm">
       <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-xl font-medium tracking-tight" placeholder="Cloud Mesh Find" />
    </div>
  </div>
);

/** 30. Pixel Art: 8-bit retro. */
export const SpotlightPixel = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-[#333] p-1 shadow-[8px_8px_0_#000]">
    <div className="border-[4px] border-[#fff] p-4 flex items-center gap-4">
       <div className="w-4 h-4 bg-white" />
       <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-[#fff] font-mono text-xl uppercase" style={{ imageRendering: 'pixelated' }} placeholder="LVL1_SEARCH" />
    </div>
  </div>
);

/** 31. Aurora Borealis: Shifting lights. */
export const SpotlightAurora = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-zinc-950 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_50px_rgba(0,255,100,0.1)] border border-emerald-500/20">
    <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-400 blur-sm animate-pulse" />
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-emerald-100 text-2xl font-thin tracking-[0.2em]" placeholder="Aurora Find" />
  </div>
);

/** 32. Cyberpunk Industrial: Circuitry pattern. */
export const SpotlightCyber = (props: SearchVariantProps) => (
  <div className="w-[480px] bg-[#1a1a1a] rounded p-6 shadow-2xl border-t-4 border-yellow-400 border-l-2 border-zinc-800">
    <div className="flex justify-between items-center mb-4">
       <span className="text-yellow-400 text-[9px] font-black uppercase tracking-widest underline">Critical System</span>
       <div className="flex gap-1">
          <div className="w-2 h-2 bg-yellow-400" />
          <div className="w-2 h-2 bg-zinc-800" />
       </div>
    </div>
    <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-zinc-100 text-2xl font-black italic tracking-tighter" placeholder="SYSTEM_CRASH_SEARCH" />
  </div>
);

/** 33. Invisible Ink: Fades to blur. */
export const SpotlightInvisible = (props: SearchVariantProps) => {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (props.query) {
      setActive(true);
      const timer = setTimeout(() => setActive(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [props.query]);

  return (
    <div className="w-[480px] bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl transition-all duration-1000 border border-zinc-100 dark:border-zinc-800">
       <motion.div animate={{ filter: active ? "blur(0px)" : "blur(10px)", opacity: active ? 1 : 0.2 }} transition={{ duration: 1 }}>
         <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} className="w-full bg-transparent outline-none text-center text-4xl font-thin italic" placeholder="Invisible Ink" />
       </motion.div>
    </div>
  );
};
