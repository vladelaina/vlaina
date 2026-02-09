import { cn } from '@/lib/utils';

export function BubbleLab({ onClose }: { onClose: () => void }) {
  const sampleText = "Can you help me refactor this code to be more modular?";
  
  const variants = [
    { name: "Classic GPT", className: "bg-[#f4f4f4] dark:bg-[#2f2f2f] px-5 py-2.5 rounded-3xl" },
    { name: "Modern Soft", className: "bg-gray-100 dark:bg-zinc-800 px-4 py-2 rounded-2xl" },
    { name: "Super Compact", className: "bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 px-3 py-1.5 rounded-xl text-sm" },
    { name: "Boxy Minimal", className: "bg-gray-100 dark:bg-zinc-800 px-4 py-2 rounded-lg" },
    { name: "High Contrast", className: "bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-[20px]" },
    { name: "Subtle Outline", className: "bg-transparent border border-gray-300 dark:border-zinc-600 px-4 py-2 rounded-2xl" },
    { name: "Wide Breath", className: "bg-gray-100 dark:bg-zinc-800 px-6 py-3 rounded-[28px]" },
    { name: "Asymmetric (No Tail)", className: "bg-[#F4F4F5] dark:bg-[#303030] px-5 py-2.5 rounded-[24px]" },
    { name: "Flat & Square", className: "bg-gray-50 dark:bg-zinc-900 px-4 py-2 rounded-md border border-gray-100" },
    { name: "Glassy", className: "bg-white/80 dark:bg-white/10 backdrop-blur-md border border-white/20 px-5 py-2.5 rounded-3xl shadow-sm" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-black overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Bubble Laboratory 🧪</h1>
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Close</button>
        </div>
        
        <div className="grid gap-8">
            {variants.map((v, i) => (
                <div key={i} className="space-y-2">
                    <div className="text-xs font-mono text-gray-400">{v.name}</div>
                    <div className="flex justify-end">
                        <div className={cn(
                            "inline-block text-gray-900 dark:text-gray-100 text-[15px] leading-relaxed break-words",
                            v.className
                        )}>
                            {sampleText}
                        </div>
                    </div>
                    <div className="text-[10px] text-gray-300 font-mono select-all bg-gray-50 p-2 rounded">
                        {v.className}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
