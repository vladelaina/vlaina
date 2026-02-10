import { motion } from 'framer-motion';

export function ChatLoading() {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex w-fit items-center space-x-1.5 py-3 mt-2 self-start rounded-full px-4 min-w-0 bg-[#f5f5f5] dark:bg-[#222] border border-transparent dark:border-white/5"
        >
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{
                        duration: 0.6, // "Neural Pulse" speed - extremely snappy
                        repeat: Infinity,
                        delay: i * 0.1, // Tight wave
                        ease: "easeInOut"
                    }}
                />
            ))}
        </motion.div>
    );
}
