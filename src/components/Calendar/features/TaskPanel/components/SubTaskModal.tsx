import { motion, AnimatePresence } from 'framer-motion';

interface SubTaskModalProps {
    show: boolean;
    content: string;
    onContentChange: (content: string) => void;
    onSubmit: () => void;
    onClose: () => void;
}

export function SubTaskModal({
    show,
    content,
    onContentChange,
    onSubmit,
    onClose,
}: SubTaskModalProps) {
    if (!show) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-80 p-4"
                >
                    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-3">
                        Add Sub-task
                    </h3>
                    <input
                        type="text"
                        value={content}
                        onChange={(e) => onContentChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onSubmit();
                            if (e.key === 'Escape') onClose();
                        }}
                        placeholder="Sub-task content..."
                        autoFocus
                        className="w-full px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-md outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-600"
                    />
                    <div className="flex justify-end gap-2 mt-3">
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onSubmit}
                            disabled={!content.trim()}
                            className="px-3 py-1.5 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md disabled:opacity-50"
                        >
                            Add
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
