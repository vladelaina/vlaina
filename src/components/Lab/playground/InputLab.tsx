import { PremiumGlass, SolidMinimalist, NeonBorder, FloatingIsland, GhostInput } from "../variants/InputVariants";

export function InputLab() {
  const variants = [
    { name: "Premium Glass (Current)", component: PremiumGlass, description: "Apple-style blur & depth" },
    { name: "Solid Minimalist", component: SolidMinimalist, description: "Clean, high contrast" },
    { name: "Neon Border", component: NeonBorder, description: "Cyber/Tech aesthetic" },
    { name: "Floating Island", component: FloatingIsland, description: "Detached action button" },
    { name: "Ghost Input", component: GhostInput, description: "Invisible until active" },
  ];

  return (
    <div className="flex flex-col gap-12 max-w-4xl mx-auto p-8 pb-32">
        {variants.map((v, i) => (
            <div key={i} className="flex flex-col gap-4">
                <div className="flex items-baseline justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                    <div className="flex items-center gap-3">
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 text-xs font-mono font-bold text-gray-500">
                            {i + 1}
                        </span>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{v.name}</h3>
                    </div>
                    <span className="text-xs text-gray-400">{v.description}</span>
                </div>
                
                {/* Pure White Background - No distractions */}
                <div className="p-20 rounded-[32px] bg-white dark:bg-[#0f0f0f] border border-gray-100 dark:border-zinc-800 relative shadow-sm flex items-center justify-center">
                    <div className="w-full relative z-10">
                        <v.component />
                    </div>
                </div>
            </div>
        ))}
    </div>
  );
}
