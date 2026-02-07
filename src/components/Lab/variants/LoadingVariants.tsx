import { motion } from 'framer-motion';
import { MdAutoAwesome } from 'react-icons/md';

// Variant 1: Harmonic Stream (Current Best)
export function HarmonicStream() {
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-gray-800">
            <div className="w-8 h-8 flex items-center justify-center opacity-40">
                <MdAutoAwesome className="text-gray-400 dark:text-gray-500 w-5 h-5" />
            </div>
            <div className="flex items-center gap-[3px] h-6 px-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
                    const centerDist = Math.abs(i - 5.5);
                    const heightScale = Math.max(0.3, 1 - (centerDist / 6));
                    const maxH = 6 + 18 * heightScale;
                    return (
                        <motion.div
                            key={i}
                            className="w-[2px] rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                            initial={{ height: 4, opacity: 0.3 }}
                            animate={{ height: [6, maxH, 6], opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.04, ease: "easeInOut" }}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// Variant 2: Chaotic Pulse (High Energy)
export function ChaoticPulse() {
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-gray-800">
            <div className="w-8 h-8 flex items-center justify-center opacity-40">
                <MdAutoAwesome className="text-blue-500 w-5 h-5 animate-pulse" />
            </div>
            <div className="flex items-center gap-[3px] h-6 px-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
                    const duration = 0.4 + (i % 3) * 0.1;
                    const maxH = 14 + (i % 4) * 4;
                    return (
                        <motion.div
                            key={i}
                            className="w-[2px] rounded-full bg-blue-500"
                            initial={{ height: 4, opacity: 0.4 }}
                            animate={{ 
                                height: [6, maxH, 4, maxH * 0.6, 6],
                                opacity: [0.4, 1, 0.5, 0.8, 0.4],
                                backgroundColor: ["#3B82F6", "#93C5FD", "#3B82F6"]
                            }}
                            transition={{ duration: duration, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// Variant 3: Fluid Beam (Sleek)
export function FluidBeam() {
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-gray-800">
            <div className="w-8 h-8 flex items-center justify-center">
                <MdAutoAwesome className="text-blue-500 w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col gap-1">
                <div className="relative h-1 w-20 overflow-hidden rounded-full bg-blue-50/50 dark:bg-blue-900/10">
                    <motion.div 
                        className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: "circInOut" }}
                    />
                    <motion.div 
                        className="absolute top-0 left-0 h-full w-full bg-blue-400/20 blur-[2px]"
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                </div>
            </div>
        </div>
    );
}

// Variant 4: Classic Bounce (Minimal)
export function ClassicBounce() {
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-gray-800">
            <div className="flex gap-1.5 pl-2">
                {[0, 1, 2].map(i => (
                    <motion.div
                        key={i}
                        className="w-2 h-2 bg-gray-400 rounded-full"
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                    />
                ))}
            </div>
        </div>
    );
}

// Variant 5: Neural Stardust (Organic Dots)
export function NeuralStardust() {
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-gray-800">
            <div className="relative h-8 w-24 flex items-center justify-center gap-1">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="h-2 w-2 rounded-full bg-blue-500 blur-[1px]"
                        animate={{
                            y: [-3, 3, -3],
                            scale: [1, 1.3, 1],
                            opacity: [0.4, 0.8, 0.4]
                        }}
                        transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: i * 0.3,
                            ease: "easeInOut"
                        }}
                    />
                ))}
                <motion.div
                    className="absolute inset-0 bg-blue-400/10 blur-md rounded-full"
                    animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            </div>
        </div>
    );
}
