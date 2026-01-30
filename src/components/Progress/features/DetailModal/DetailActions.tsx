import { motion } from 'framer-motion';
import {
  MdMoreHoriz,
  MdClose,
  MdDelete,
  MdArchive,
  MdRefresh,
} from 'react-icons/md';

interface DetailActionsProps {
  showMenu: boolean;
  isArchived: boolean;
  onMenuToggle: (show: boolean) => void;
  onArchive: () => void;
  onReset: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function DetailActions({
  showMenu,
  isArchived,
  onMenuToggle,
  onArchive,
  onReset,
  onDelete,
  onClose,
}: DetailActionsProps) {
  if (isArchived) {
      return (
        <button
            onClick={onClose}
            className="absolute top-6 right-6 z-50 p-2 rounded-full bg-zinc-100/50 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors backdrop-blur-md"
        >
            <MdClose className="size-5" />
        </button>
      );
  }

  return (
    <div className="absolute top-6 right-6 z-50 flex items-center justify-end">
          <motion.div
            layout
            className={`
              relative flex items-center justify-end
              overflow-hidden 
              bg-zinc-100/50 dark:bg-zinc-800/50 backdrop-blur-md
              hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80
              shadow-sm
            `}
            initial={false}
            animate={{
              width: showMenu ? 'auto' : 40,
              height: 40,
              borderRadius: 9999,
              backgroundColor: showMenu 
                  ? (document.documentElement.classList.contains('dark') ? 'rgba(39, 39, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)')
                  : (document.documentElement.classList.contains('dark') ? 'rgba(39, 39, 42, 0.4)' : 'rgba(244, 244, 245, 0.4)')
            }}
            transition={{
              type: 'spring',
              stiffness: 700,
              damping: 35,
              mass: 0.8,
            }}
          >
                     {/* State A: The Totem (Dots) */}
                    <motion.button
                      className="absolute inset-0 flex items-center justify-center text-zinc-500 dark:text-zinc-400 transition-colors"
                      onClick={() => onMenuToggle(true)}
                      animate={{
                        opacity: showMenu ? 0 : 1,
                        scale: showMenu ? 0.5 : 1,
                        pointerEvents: showMenu ? 'none' : 'auto',
                        filter: showMenu ? 'blur(4px)' : 'blur(0px)',
                      }}
                      transition={{ duration: 0.15 }}
                    >
                      <MdMoreHoriz className="size-6" />
                    </motion.button>
                     
                     {/* State B: The Panel (Actions) */}
                    <motion.div
                      className="flex items-center gap-1 pl-1 pr-1 h-full min-w-max"
                      animate={{
                        opacity: showMenu ? 1 : 0,
                        filter: showMenu ? 'blur(0px)' : 'blur(4px)',
                        pointerEvents: showMenu ? 'auto' : 'none',
                        x: showMenu ? 0 : 20, 
                      }}
                      transition={{ 
                          type: "spring",
                          stiffness: 700,
                          damping: 35,
                          mass: 0.8
                      }}
                    >
                      {/* Archive */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onArchive(); }}
                        className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
                        title="Archive"
                      >
                        <MdArchive className="size-5" />
                      </button>
        
                      {/* Reset */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onReset(); }}
                        className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
                        title="Reset"
                      >
                        <MdRefresh className="size-5" />
                      </button>
        
                      <div className="w-px h-[18px] bg-zinc-200 dark:bg-zinc-700/50 mx-1" />
        
                      {/* Delete */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-2 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete"
                      >
                        <MdDelete className="size-5" />
                      </button>
        
                      <div className="w-px h-[18px] bg-zinc-200 dark:bg-zinc-700/50 mx-1" />
        
                      {/* Close */}
                      <button
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (showMenu) onMenuToggle(false);
                            else onClose(); 
                        }}
                        className="p-2 rounded-full text-zinc-300 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                      >
                        <MdClose className="size-[18px]" />
                      </button>
                    </motion.div>
                  </motion.div>
    </div>
  );
}
