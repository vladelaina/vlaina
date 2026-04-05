import { useState } from 'react';
import * as Variants from '../variants/SearchVariants';
import { cn } from '@/lib/utils';

const RESERVED_LIST = [
  { id: 'master', name: 'Reserved: Spotlight Pro', Component: Variants.SpotlightPro },
  { id: 'pearl', name: 'Reserved: Pearl', Component: Variants.SpotlightPearl },
  { id: 'glass-max', name: 'Reserved: Glass Max', Component: Variants.SpotlightGlassMax },
  { id: 'pulse', name: 'Reserved: Pulse', Component: Variants.SpotlightPulse },
];

const NEW_EVOLUTIONS_LIST = [
  { id: 'zen', name: 'Evolution 04: Zen (Washi)', Component: Variants.SpotlightZen },
  { id: 'obsidian-zen', name: 'Evolution 05: Obsidian Zen', Component: Variants.SpotlightObsidianZen },
  { id: 'carbon', name: 'Evolution 06: Carbon Fiber', Component: Variants.SpotlightCarbon },
  { id: 'liquid-gold', name: 'Evolution 07: Liquid Gold', Component: Variants.SpotlightLiquidGold },
  { id: 'slate', name: 'Evolution 08: Slate Stone', Component: Variants.SpotlightSlate },
  { id: 'etched', name: 'Evolution 09: Etched Glass', Component: Variants.SpotlightEtched },
  { id: 'magnetic-flux', name: 'Evolution 10: Magnetic Flux', Component: Variants.SpotlightMagneticFlux },
  { id: 'glitch', name: 'Evolution 11: Glitch Core', Component: Variants.SpotlightGlitch },
  { id: 'bio', name: 'Evolution 12: Bio-Organic', Component: Variants.SpotlightBio },
  { id: 'accordion', name: 'Evolution 13: Accordion', Component: Variants.SpotlightAccordion },
  { id: 'shadow-focus', name: 'Evolution 14: Shadow-Focus', Component: Variants.SpotlightShadowFocus },
  { id: 'bubble', name: 'Evolution 15: Bouncy Bubble', Component: Variants.SpotlightBubble },
  { id: 'prism-v2', name: 'Evolution 16: Prism Dispersion', Component: Variants.SpotlightPrismV2 },
  { id: 'luminous', name: 'Evolution 17: Luminous Text', Component: Variants.SpotlightLuminous },
  { id: 'silhouette', name: 'Evolution 18: Silhouette', Component: Variants.SpotlightSilhouette },
  { id: 'neon', name: 'Evolution 19: Neon Glow', Component: Variants.SpotlightNeon },
  { id: 'holograph', name: 'Evolution 20: Holographic', Component: Variants.SpotlightHolograph },
  { id: 'blur-v2', name: 'Evolution 21: Interactive Blur v2', Component: Variants.SpotlightBlurV2 },
  { id: 'side-kick', name: 'Evolution 22: Side-Kick', Component: Variants.SpotlightSideKick },
  { id: 'timeline', name: 'Evolution 23: Timeline Trace', Component: Variants.SpotlightTimeline },
  { id: 'sticker', name: 'Evolution 24: Sticker', Component: Variants.SpotlightSticker },
  { id: 'wide-span', name: 'Evolution 25: Wide-Span', Component: Variants.SpotlightWideSpan },
  { id: 'compact', name: 'Evolution 26: Compact Mono', Component: Variants.SpotlightCompact },
  { id: 'retro-pinstripe', name: 'Evolution 27: Pinstripe Retro', Component: Variants.SpotlightRetroPinstripe },
  { id: 'void', name: 'Evolution 28: The Void', Component: Variants.SpotlightVoid },
  { id: 'cloud', name: 'Evolution 29: Cloud Mesh', Component: Variants.SpotlightCloud },
  { id: 'pixel', name: 'Evolution 30: Pixel Art', Component: Variants.SpotlightPixel },
  { id: 'aurora', name: 'Evolution 31: Aurora Borealis', Component: Variants.SpotlightAurora },
  { id: 'cyber', name: 'Evolution 32: Cyberpunk Industrial', Component: Variants.SpotlightCyber },
  { id: 'invisible', name: 'Evolution 33: Invisible Ink', Component: Variants.SpotlightInvisible },
];

export function SearchDesignLab() {
  const [query, setQuery] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [activeMatch, setActiveMatch] = useState(1);
  const totalMatches = 42;

  const commonProps: Variants.SearchVariantProps = {
    query,
    setQuery,
    replaceValue,
    setReplaceValue,
    isReplaceOpen,
    toggleReplace: () => setIsReplaceOpen(!isReplaceOpen),
    activeMatch,
    totalMatches,
    onNext: () => setActiveMatch(prev => (prev % totalMatches) + 1),
    onPrev: () => setActiveMatch(prev => (prev === 1 ? totalMatches : prev - 1)),
    onReplace: () => console.log('Replace'),
    onReplaceAll: () => console.log('Replace All'),
    onClose: () => setQuery(''),
  };

  const renderSection = (title: string, list: typeof RESERVED_LIST, isReserved: boolean) => (
    <div className="space-y-12">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-black tracking-[0.4em] uppercase text-zinc-400">{title}</h2>
        <div className="h-[1px] flex-1 bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="grid grid-cols-1 gap-20 items-start">
        {list.map(({ id, name, Component }) => (
          <div key={id} className={cn(
            "space-y-6 p-8 rounded-[48px] transition-all",
            isReserved ? "bg-blue-500/5 border-2 border-blue-500/20 shadow-2xl" : "bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-100 dark:border-zinc-800/50"
          )}>
            <div className="flex items-center justify-between px-4">
              <h3 className={cn(
                "text-xs font-black uppercase tracking-[0.3em]",
                isReserved ? "text-blue-500" : "text-zinc-400"
              )}>{name}</h3>
              {isReserved && <span className="bg-blue-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Reserved Favorite</span>}
            </div>
            <div className="min-h-[260px] flex items-center justify-center p-12 overflow-hidden relative group">
              <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:30px_30px]" />
              <Component {...commonProps} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-24 pb-24">
      <header className="max-w-3xl">
        <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-100 uppercase italic">Spotlight: The Ultimate Collection</h1>
        <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
          Reserved favorites plus 30 brand new architectural evolutions. 
          The definitive exploration of the master search paradigm.
        </p>
      </header>

      {renderSection("The Favorites", RESERVED_LIST, true)}
      {renderSection("New Evolutions", NEW_EVOLUTIONS_LIST, false)}
    </div>
  );
}

export default SearchDesignLab;
