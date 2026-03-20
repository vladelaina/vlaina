import { motion } from 'framer-motion';
export function SmartCursor() {
    return (
        <div className="flex items-center gap-1 h-6">
            <motion.div
                className="w-[3px] h-4 bg-blue-500 rounded-sm"
                animate={{ 
                    height: [16, 16, 16],
                    x: [0, 10, 0, -5, 0], 
                    opacity: [1, 0.5, 1]
                }}
                transition={{ duration: 0.8, repeat: Infinity }}
            />
            <motion.div
                className="w-2 h-2 rounded-full bg-blue-400"
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
            />
        </div>
    );
}

export function ElasticVelocity() {
    return (
        <div className="flex items-center gap-4">
            <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-blue-50/50 dark:bg-blue-900/20">
                <motion.div 
                    className="absolute top-0 bottom-0 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]"
                    initial={{ left: 0, width: "10%" }}
                    animate={{ 
                        left: ["0%", "30%", "90%", "30%", "0%"],
                        width: ["15%", "50%", "15%", "50%", "15%"], 
                    }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", times: [0, 0.25, 0.5, 0.75, 1] }}
                />
            </div>
        </div>
    );
}

export function HarmonicStream() {
    return (
        <div className="flex items-center gap-4">
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

export function InfinityFlow() {
    return (
        <div className="flex items-center gap-4">
            <div className="relative w-24 h-8 flex items-center justify-center">
                {[0, 1].map((i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                        animate={{
                            x: [0, 20, 0, -20, 0],
                            y: [0, -6, 0, 6, 0], 
                            scale: [1, 0.8, 1, 1.2, 1],
                            zIndex: [0, 0, 0, 10, 0] 
                        }}
                        transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.8, ease: "linear" }}
                    />
                ))}
                <motion.div 
                    className="absolute w-12 h-4 border border-amber-500/20 rounded-full"
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            </div>
        </div>
    );
}

export function DigitalHelix() {
    return (
        <div className="flex items-center gap-4">
            <div className="relative h-8 w-28 flex items-center justify-center overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={`a-${i}`}
                        className="absolute w-[6px] h-[6px] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 50, y: [0, -10, 0, 10, 0], opacity: [0, 1, 1, 1, 0], scale: [0.8, 1.2, 1, 0.8, 0.5] }}
                        transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.3, ease: "linear" }}
                        style={{ left: "50%", top: "50%", marginLeft: -3, marginTop: -3 }}
                    />
                ))}
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={`b-${i}`}
                        className="absolute w-[6px] h-[6px] rounded-full bg-blue-400/80"
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 50, y: [0, 10, 0, -10, 0], opacity: [0, 1, 1, 1, 0], scale: [0.8, 0.8, 1, 1.2, 0.5] }}
                        transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.3, ease: "linear" }}
                        style={{ left: "50%", top: "50%", marginLeft: -3, marginTop: -3 }}
                    />
                ))}
            </div>
        </div>
    );
}

export function FluidBeam() {
    return (
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
    );
}

export function CosmicDust() {
    return (
        <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 flex items-center justify-center">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1.5 h-1.5 rounded-full bg-fuchsia-500"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                            scale: [0, 1, 0],
                            opacity: [0, 1, 0],
                            x: [0, (i % 2 === 0 ? 1 : -1) * (10 + Math.random() * 10)],
                            y: [0, (i % 3 === 0 ? 1 : -1) * (10 + Math.random() * 10)],
                        }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1, ease: "easeOut" }}
                    />
                ))}
                <motion.div
                    className="absolute w-3 h-3 rounded-full bg-fuchsia-400 blur-sm"
                    animate={{ scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                />
            </div>
        </div>
    );
}

export function HighVibeElastic() {
    return (
        <div className="flex items-center gap-4">
            <div className="relative h-6 w-28 flex items-center justify-center overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={`a-${i}`}
                        className="absolute h-[4px] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                        initial={{ x: -50, width: 4 }}
                        animate={{ 
                            x: 50, 
                            y: [0, -5, 0, 5, 0], 
                            width: [4, 16, 4, 16, 4], 
                            opacity: [0, 1, 1, 1, 0],
                        }}
                        transition={{ duration: 1.0, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                        style={{ left: "50%", top: "50%", marginTop: -2, marginLeft: -2 }}
                    />
                ))}
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={`b-${i}`}
                        className="absolute h-[4px] rounded-full bg-blue-400/80"
                        initial={{ x: -50, width: 4 }}
                        animate={{ 
                            x: 50, 
                            y: [0, 5, 0, -5, 0], 
                            width: [4, 16, 4, 16, 4], 
                            opacity: [0, 1, 1, 1, 0],
                        }}
                        transition={{ duration: 1.0, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                        style={{ left: "50%", top: "50%", marginTop: -2, marginLeft: -2 }}
                    />
                ))}
            </div>
        </div>
    );
}

export function SilkStream() {
    return (
        <div className="flex items-center gap-4">
            <div className="relative h-6 w-28 flex items-center justify-center overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={`a-${i}`}
                        className="absolute h-[3px] rounded-full bg-blue-500"
                        initial={{ x: -50, width: 10 }}
                        animate={{ 
                            x: 50, 
                            y: [0, -4, 0, 4, 0], 
                            width: [10, 20, 10, 20, 10], 
                            opacity: [0, 0.8, 1, 0.8, 0],
                        }}
                        transition={{ duration: 2.0, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
                        style={{ left: "50%", top: "50%", marginTop: -1.5, marginLeft: -5 }}
                    />
                ))}
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={`b-${i}`}
                        className="absolute h-[3px] rounded-full bg-blue-400/60"
                        initial={{ x: -50, width: 10 }}
                        animate={{ 
                            x: 50, 
                            y: [0, 4, 0, -4, 0], 
                            width: [10, 20, 10, 20, 10], 
                            opacity: [0, 0.8, 1, 0.8, 0],
                        }}
                        transition={{ duration: 2.0, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
                        style={{ left: "50%", top: "50%", marginTop: -1.5, marginLeft: -5 }}
                    />
                ))}
            </div>
        </div>
    );
}

export function TidalBreath() {
    return (
        <div className="flex items-center gap-4">
            <div className="relative h-6 w-28 flex items-center justify-center overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={`a-${i}`}
                        className="absolute h-[4px] rounded-full bg-blue-500"
                        initial={{ x: -50, width: 6 }}
                        animate={{ 
                            x: 50, 
                            y: [0, -6, 0, 6, 0], 
                            width: [6, 12, 6, 12, 6],
                            opacity: [0, 1, 1, 1, 0],
                        }}
                        transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3, ease: "easeOut" }}
                        style={{ left: "50%", top: "50%", marginTop: -2, marginLeft: -3 }}
                    />
                ))}
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={`b-${i}`}
                        className="absolute h-[4px] rounded-full bg-blue-400/80"
                        initial={{ x: -50, width: 6 }}
                        animate={{ 
                            x: 50, 
                            y: [0, 6, 0, -6, 0], 
                            width: [6, 12, 6, 12, 6],
                            opacity: [0, 1, 1, 1, 0],
                        }}
                        transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3, ease: "easeOut" }}
                        style={{ left: "50%", top: "50%", marginTop: -2, marginLeft: -3 }}
                    />
                ))}
            </div>
        </div>
    );
}

export function GhostThread() {
    return (
        <div className="flex items-center gap-4">
            <div className="relative h-6 w-28 flex items-center justify-center overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={`a-${i}`}
                        className="absolute h-[2px] rounded-full bg-blue-500"
                        initial={{ x: -50, width: 4 }}
                        animate={{ 
                            x: 50, 
                            y: [0, -3, 0, 3, 0], 
                            width: [4, 8, 4, 8, 4],
                            opacity: [0, 0.6, 0.8, 0.6, 0],
                        }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.25, ease: "linear" }}
                        style={{ left: "50%", top: "50%", marginTop: -1, marginLeft: -2 }}
                    />
                ))}
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={`b-${i}`}
                        className="absolute h-[2px] rounded-full bg-blue-400/50"
                        initial={{ x: -50, width: 4 }}
                        animate={{ 
                            x: 50, 
                            y: [0, 3, 0, -3, 0], 
                            width: [4, 8, 4, 8, 4],
                            opacity: [0, 0.6, 0.8, 0.6, 0],
                        }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.25, ease: "linear" }}
                        style={{ left: "50%", top: "50%", marginTop: -1, marginLeft: -2 }}
                    />
                ))}
            </div>
        </div>
    );
}

export function MagneticFloat() {
    return (
        <div className="flex items-center gap-4">
            <div className="relative h-6 w-28 flex items-center justify-center overflow-hidden">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={`a-${i}`}
                        className="absolute h-[4px] rounded-full bg-blue-500"
                        initial={{ x: -60, width: 12 }}
                        animate={{ 
                            x: 60, 
                            y: [0, -8, 0],
                            opacity: [0, 1, 0],
                        }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
                        style={{ left: "50%", top: "50%", marginTop: -2, marginLeft: -6 }}
                    />
                ))}
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={`b-${i}`}
                        className="absolute h-[4px] rounded-full bg-blue-400/80"
                        initial={{ x: -60, width: 12 }}
                        animate={{ 
                            x: 60, 
                            y: [0, 8, 0], 
                            opacity: [0, 1, 0],
                        }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
                        style={{ left: "50%", top: "50%", marginTop: -2, marginLeft: -6 }}
                    />
                ))}
            </div>
        </div>
    );
}

export function LuminousPulse() {
    return (
        <div className="flex items-center gap-4">
            <div className="relative h-6 w-28 flex items-center justify-center">
                <motion.div
                    className="absolute h-[4px] bg-blue-500 rounded-full"
                    animate={{ 
                        width: [40, 60, 40],
                        opacity: [0.4, 0.8, 0.4],
                        boxShadow: ["0 0 0px rgba(59,130,246,0)", "0 0 10px rgba(59,130,246,0.5)", "0 0 0px rgba(59,130,246,0)"]
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute h-[4px] bg-blue-400/50 rounded-full"
                    animate={{ 
                        width: [60, 40, 60], // Opposite breathing
                        opacity: [0.2, 0.5, 0.2]
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>
        </div>
    );
}
