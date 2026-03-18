import { useState } from 'react';
import { cn } from '@/lib/utils';
import { googleButtonVariants, type GoogleButtonVariant } from '../variants/googleButtonVariants';

function ButtonPreview({ variant }: { variant: GoogleButtonVariant }) {
  return (
    <div className={cn(
      "w-full max-w-[360px] rounded-[50px] p-10 flex flex-col items-center gap-8 transition-all duration-700",
      "bg-white dark:bg-zinc-900",
      "shadow-[0_40px_80px_rgba(0,0,0,0.05),inset_0_0_20px_rgba(255,255,255,1)] dark:shadow-[0_40px_100px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)]",
      "border border-white dark:border-zinc-800"
    )}>
      <div className="text-center space-y-1">
        <h4 className="text-[13px] font-black uppercase tracking-[0.2em] text-zinc-300 dark:text-zinc-600">Component Test</h4>
      </div>

      <button className={cn(
        "w-full flex items-center justify-center gap-3 h-14 px-6 transition-all duration-500",
        variant.containerBg,
        variant.borderClass,
        variant.textClass,
        variant.shadowClass,
        variant.hoverEffect || "hover:scale-[1.02] active:scale-[0.97] rounded-[24px]"
      )}>
        <div className={cn(
          "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm",
          variant.badgeClass
        )}>
          G
        </div>
        <span className="font-bold text-[15px] tracking-tight">Continue with Google</span>
      </button>

      <div className="w-full space-y-3 opacity-20 pointer-events-none">
         <div className="h-12 w-full bg-zinc-100 dark:bg-zinc-800 rounded-2xl" />
         <div className="h-12 w-full bg-zinc-100 dark:bg-zinc-800 rounded-2xl" />
      </div>
    </div>
  );
}

export function GoogleButtonLab() {
  const [viewMode, setViewMode] = useState<'light' | 'dark'>('light');

  return (
    <div className={cn("mx-auto flex max-w-[1600px] flex-col gap-16 pb-32 transition-colors duration-500", viewMode === 'dark' ? "dark" : "")}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 px-6">
        <div className="max-w-2xl text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.15em]">
            Material Study: The Action
          </div>
          <h2 className="mt-4 text-5xl font-black tracking-tighter text-zinc-950 dark:text-white">
            Google Button Boutique
          </h2>
          <p className="mt-4 text-[17px] font-medium text-zinc-500 dark:text-zinc-400">
            Exploring 30 curated states for the primary OAuth action. Finding the perfect balance between brand identity and the Ceramic Pro aesthetic.
          </p>
        </div>

        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-inner">
           <button 
             onClick={() => setViewMode('light')}
             className={cn("px-6 py-2 rounded-xl text-xs font-black transition-all", viewMode === 'light' ? "bg-white text-zinc-950 shadow-md" : "text-zinc-500")}
           >
             Light
           </button>
           <button 
             onClick={() => setViewMode('dark')}
             className={cn("px-6 py-2 rounded-xl text-xs font-black transition-all", viewMode === 'dark' ? "bg-zinc-900 text-white shadow-md border border-white/5" : "text-zinc-500")}
           >
             Dark
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12 px-6">
        {googleButtonVariants.map((variant, index) => (
          <div key={variant.id} className="flex flex-col gap-4">
            <div className="flex items-center gap-3 px-4">
               <span className="text-[11px] font-black text-zinc-300 dark:text-zinc-700">#{String(index + 1).padStart(2, '0')}</span>
               <h3 className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">{variant.name}</h3>
            </div>
            <div className="group relative overflow-hidden rounded-[60px] border border-zinc-200/50 bg-[#f8f8f8] dark:bg-zinc-950 p-8 flex items-center justify-center transition-all hover:bg-white dark:hover:bg-zinc-900">
               <ButtonPreview variant={variant} />
               <div className="absolute bottom-4 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[11px] font-medium text-zinc-400 px-10 italic">"{variant.note}"</p>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
