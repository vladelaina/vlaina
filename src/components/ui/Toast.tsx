import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore, type Toast as ToastType } from '@/stores/useToastStore';
import { cn } from '@/lib/utils';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

interface ToastItemProps {
  toast: ToastType;
  onClose: (id: string) => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      role="button"
      tabIndex={0}
      onClick={() => onClose(toast.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClose(toast.id);
        }
      }}
      className={cn(
        chatComposerPillSurfaceClass,
        'relative flex cursor-pointer items-center overflow-hidden rounded-[26px] px-4 py-3',
        'min-w-[300px] max-w-[min(500px,calc(100vw-32px))]',
        'text-[var(--vlaina-text-primary)] transition-all duration-300 ease-out'
      )}
    >
      <p className="flex-1 text-sm font-medium leading-5 text-[var(--vlaina-text-primary)]">{toast.message}</p>
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex max-w-[calc(100vw-32px)] flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onClose={removeToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
