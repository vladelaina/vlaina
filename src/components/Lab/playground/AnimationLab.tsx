import { HarmonicStream, ChaoticPulse, FluidBeam, ClassicBounce, NeuralStardust } from "../variants/LoadingVariants";

export function AnimationLab() {
  const variants = [
    { name: "Harmonic Stream (Current)", component: HarmonicStream, description: "Bell-curve ordered wave" },
    { name: "Chaotic Pulse", component: ChaoticPulse, description: "Randomized high-speed rhythm" },
    { name: "Fluid Beam", component: FluidBeam, description: "Apple-style gradient flow" },
    { name: "Neural Stardust", component: NeuralStardust, description: "Orbiting particles" },
    { name: "Classic Bounce", component: ClassicBounce, description: "Baseline reference" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto p-8">
        {variants.map((v, i) => (
            <div key={i} className="flex flex-col gap-4 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E1E] shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{v.name}</h3>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded text-xs font-mono text-gray-500">#{i + 1}</span>
                </div>
                
                <div className="py-8 flex items-center justify-center bg-gray-50 dark:bg-black/20 rounded-xl">
                    <v.component />
                </div>
                
                <p className="text-xs text-gray-400 mt-auto">{v.description}</p>
            </div>
        ))}
    </div>
  );
}
