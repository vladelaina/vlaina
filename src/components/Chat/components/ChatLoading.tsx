import { motion } from 'framer-motion';

export function ChatLoading() {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex w-full justify-start pl-0 mt-4 mb-2"
        >
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
        </motion.div>
    );
}