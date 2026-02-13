import { motion } from 'framer-motion';

export function WelcomeScreen() {
  return (
    <motion.div 
        key="welcome"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-5 text-center"
    >
        <h1 className="text-3xl font-bold text-black dark:text-white select-none tracking-tight">
            Ciallo~(∠・ω&lt;)⌒★
        </h1>
    </motion.div>
  );
}
