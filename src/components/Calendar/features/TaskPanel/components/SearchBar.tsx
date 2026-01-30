import { MdClose } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
    show: boolean;
    value: string;
    onChange: (value: string) => void;
    onClear: () => void;
}

export function SearchBar({ show, value, onChange, onClear }: SearchBarProps) {
    if (!show) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
            >
                <div className="relative mt-2">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="Search tasks..."
                        autoFocus
                        className="w-full px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-md outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-600"
                    />
                    {value && (
                        <button
                            onClick={onClear}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                        >
                            <MdClose className="size-3.5" />
                        </button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
