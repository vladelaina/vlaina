import { MdCheck, MdError, MdMonitorHeart } from 'react-icons/md';
import { cn } from '@/lib/utils';

interface HealthCheckButtonProps {
  onCheck: () => void;
  isChecking: boolean;
  overallStatus: 'idle' | 'success' | 'error';
  disabled?: boolean;
}

export function HealthCheckButton({ onCheck, isChecking, overallStatus, disabled }: HealthCheckButtonProps) {
  return (
    <button 
        onClick={onCheck} 
        disabled={isChecking || disabled} 
        className={cn(
            "flex items-center justify-center gap-1.5 h-7 min-w-[28px] px-2 rounded-lg transition-all border",
            overallStatus === 'success' && !isChecking
                ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900/30"
                : overallStatus === 'error' && !isChecking
                ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30"
                : "bg-white dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 hover:text-gray-900 dark:hover:text-gray-200"
        )}
        title="Check All Models Health"
    >
        {isChecking ? (
            <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : overallStatus === 'success' ? (
            <MdCheck size={14} />
        ) : overallStatus === 'error' ? (
            <MdError size={14} />
        ) : (
            <MdMonitorHeart size={16} />
        )}
    </button>
  );
}