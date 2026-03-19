import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { sidebarLoginEntryVariants, type SidebarLoginEntryVariant } from '../variants/sidebarLoginEntryVariants';

function PreviewPanel({ variant }: { variant: SidebarLoginEntryVariant }) {
  const renderGoogleAction = () => (
    <button className={cn(
      "w-full flex items-center justify-center gap-3 px-6 py-4 font-bold text-[15px] transition-all duration-500 hover:shadow-xl active:scale-[0.97]",
      variant.googleBtn
    )}>
      <div className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0", variant.googleBadge || "bg-white text-black shadow-md")}>
        G
      </div>
      <span className="tracking-tight">Continue with Google</span>
    </button>
  );

  const renderEmailForm = () => (
    <div className="space-y-5 w-full">
      <div className="relative group">
        <div className={cn("w-full px-5 py-4 text-[15px] transition-all duration-500 outline-none placeholder:opacity-50", variant.emailInput)}>
          name@company.com
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">
           <div className="h-2 w-2 rounded-full bg-current" />
        </div>
      </div>
      <div className="space-y-4">
        <button className={cn("w-full py-4 font-black text-[15px] transition-all duration-500 active:scale-[0.97] shadow-2xl", variant.submitBtn)}>
          Login with Email
        </button>
        
        {/* Added Legal Note */}
        <p className={cn("text-[11px] text-center leading-relaxed px-4 opacity-60 font-medium", variant.legalNote)}>
          By continuing, you acknowledge that you have read and agree to NekoTick's <span className="underline cursor-pointer opacity-80 hover:opacity-100 transition-opacity">Terms of Service</span> and <span className="underline cursor-pointer opacity-80 hover:opacity-100 transition-opacity">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );

  return (
    <div className={cn('relative min-h-[600px] flex items-center justify-center p-16 transition-all duration-700 overflow-hidden rounded-[48px]', variant.stageBg)}>
      {/* Decorative Background Elements for Richness */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-white/5 blur-[80px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-black/5 blur-[80px]" />
      
      <div className={cn(
        "w-full max-w-[400px] relative z-10 transition-all duration-1000",
        variant.cardBg, variant.cardBorder, variant.cardShadow
      )} style={variant.customStyles?.card}>
        <div className="flex flex-col items-center gap-10 p-12">
          <div className="w-full space-y-10">
            {renderGoogleAction()}
            <div className="flex items-center gap-4 px-2">
               <div className="h-[1px] flex-1 bg-current opacity-10" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Security Standard</span>
               <div className="h-[1px] flex-1 bg-current opacity-10" />
            </div>
            {renderEmailForm()}
          </div>
          
          <div className="flex items-center gap-2 opacity-20 hover:opacity-50 transition-opacity cursor-default">
             <div className="h-1 w-1 rounded-full bg-current" />
             <div className="h-1 w-1 rounded-full bg-current" />
             <div className="h-1 w-1 rounded-full bg-current" />
          </div>
        </div>
      </div>
    </div>
  );
}

function VariantCard({ variant, index }: { variant: SidebarLoginEntryVariant; index: number }) {
  return (
    <div className="group flex flex-col gap-6">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-950 text-[12px] font-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)] group-hover:scale-110 transition-transform">
            {index}
          </span>
          <div>
            <h3 className="text-[16px] font-black tracking-tight text-zinc-900 dark:text-zinc-100">{variant.name}</h3>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{variant.category}</span>
               <div className="h-1 w-1 rounded-full bg-zinc-200" />
               <span className="text-[10px] font-medium text-zinc-400 italic">Curated Excellence</span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[56px] border border-zinc-200/50 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 shadow-2xl transition-all hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)]">
        <PreviewPanel variant={variant} />
        <div className="px-8 py-6 bg-zinc-50/50 dark:bg-white/5 backdrop-blur-md rounded-b-[44px] flex items-center justify-between">
           <p className="text-[13px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
             {variant.note}
           </p>
           <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
        </div>
      </div>
    </div>
  );
}

export function SidebarLoginEntryLab() {
  const categories = useMemo(() => {
    const cats = new Set(sidebarLoginEntryVariants.map(v => v.category));
    return ['All Collections', ...Array.from(cats)];
  }, []);

  const [activeCategory, setActiveCategory] = useState('All Collections');

  const filteredVariants = useMemo(() => {
    if (activeCategory === 'All Collections') return sidebarLoginEntryVariants;
    return sidebarLoginEntryVariants.filter(v => v.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-16 pb-32 pt-10">
      <div className="flex flex-col items-center text-center gap-6 px-4">
        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-zinc-950 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          Design Director's Cut
        </div>
        <h2 className="text-6xl font-black tracking-tighter text-zinc-950 dark:text-white max-w-4xl">
          The Art of the Entrance.
        </h2>
        <p className="text-[18px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-2xl">
          A masterclass in digital materiality. 6 curated states exploring the intersection of light, glass, and industrial precision.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mt-4">
           {categories.map(cat => (
             <button
               key={cat}
               onClick={() => setActiveCategory(cat)}
               className={cn(
                 "px-6 py-2.5 rounded-full text-xs font-black transition-all duration-500 border",
                 activeCategory === cat 
                   ? "bg-zinc-900 text-white border-zinc-900 shadow-2xl scale-105" 
                   : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
               )}
             >
               {cat}
             </button>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-20 lg:grid-cols-2 px-6">
        {filteredVariants.map((variant) => (
          <VariantCard key={variant.id} variant={variant} index={sidebarLoginEntryVariants.indexOf(variant) + 1} />
        ))}
      </div>
    </div>
  );
}
