import { 
    HarmonicStream, ElasticVelocity, DigitalHelix, FluidBeam, CosmicDust, InfinityFlow, SmartCursor,
    HighVibeElastic, SilkStream, TidalBreath, GhostThread, MagneticFloat, LuminousPulse
} from "../variants/LoadingVariants";

export function AnimationLab() {
  const variants = [
    // --- The Survivors (User Approved) ---
    { component: HighVibeElastic }, // #9 (Current Champion)
    { component: ElasticVelocity }, // #2
    { component: SmartCursor },     // #1
    { component: HarmonicStream },  // #3
    { component: InfinityFlow },    // #4
    { component: CosmicDust },      // #6
    { component: DigitalHelix },    // Classic
    { component: FluidBeam },       // Classic

    // --- The Quiet Flow Collection (5 New) ---
    { component: SilkStream },
    { component: TidalBreath },
    { component: GhostThread },
    { component: MagneticFloat },
    { component: LuminousPulse },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mx-auto">
        {variants.map((v, i) => (
            <div key={i} className="group relative flex flex-col items-center justify-center p-12 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E1E] shadow-sm hover:shadow-lg hover:border-purple-200 dark:hover:border-purple-900/30 transition-all duration-300">
                {/* Index Badge */}
                <div className="absolute top-4 left-4 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 text-[10px] font-mono font-bold text-gray-400 group-hover:text-purple-500 group-hover:bg-purple-50 dark:group-hover:bg-purple-900/20 transition-colors">
                    {i + 1}
                </div>
                
                {/* Pure Visual Content */}
                <div className="scale-125">
                    <v.component />
                </div>
            </div>
        ))}
    </div>
  );
}
