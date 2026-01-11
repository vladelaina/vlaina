/**
 * SyncButton - Manual sync button for free users
 * 
 * Design principles:
 * - Visible but not intrusive: Cloud icon with subtle visual weight
 * - Always available: Constant position in toolbar for multi-device sync
 * - Status feedback: Subtle visual changes for different states
 * - Bidirectional: Syncs both local→cloud and cloud→local
 */

import { useState } from 'react';
import { 
  Cloud, 
  CloudCheck, 
  CloudOff, 
  RefreshCw 
} from 'lucide-react';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import { useLicenseStore } from '@/stores/useLicenseStore';
import { cn } from '@/lib/utils';

interface SyncButtonProps {
  className?: string;
}

export function SyncButton({ className }: SyncButtonProps) {
  const { 
    isConnected, 
    isSyncing, 
    syncStatus, 
    syncToCloud,
    syncError,
  } = useGithubSyncStore();
  
  const { isProUser } = useLicenseStore();
  
  const [showTooltip, setShowTooltip] = useState(false);
  const [animating, setAnimating] = useState(false);

  // Don't show for PRO users (they have auto-sync)
  // Don't show if not connected to GitHub
  if (isProUser || !isConnected) {
    return null;
  }

  // Handle sync click
  const handleSync = async () => {
    if (isSyncing) return;
    
    setAnimating(true);
    await syncToCloud();
    
    // Keep animation for at least 1 second for visual feedback
    setTimeout(() => {
      setAnimating(false);
    }, 1000);
  };

  // Get status info for tooltip
  const getStatusInfo = (): { text: string; icon: React.ReactNode } => {
    if (isSyncing || animating) {
      return { text: 'Syncing...', icon: <RefreshCw className="size-4 animate-spin" /> };
    }
    if (syncStatus === 'error' || syncError) {
      return { text: 'Sync failed, click to retry', icon: <CloudOff className="size-4" /> };
    }
    return { text: 'Synced', icon: <CloudCheck className="size-4" /> };
  };

  const statusInfo = getStatusInfo();
  const isError = syncStatus === 'error' || syncError;

  return (
    <div className="relative">
      <button
        onClick={handleSync}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={isSyncing}
        className={cn(
          'relative p-1.5 rounded-md transition-colors',
          'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300',
          'hover:bg-zinc-100 dark:hover:bg-zinc-800',
          isError && 'text-red-500 hover:text-red-600',
          isSyncing && 'cursor-wait',
          className
        )}
        title="Sync to cloud"
      >
        {/* Main icon */}
        {isSyncing || animating ? (
          <RefreshCw className="size-5 animate-spin" />
        ) : isError ? (
          <CloudOff className="size-5" />
        ) : (
          <Cloud className="size-5" strokeWidth={1.5} />
        )}
        
        {/* Error indicator dot */}
        {isError && !isSyncing && (
          <span className="absolute top-0.5 right-0.5 size-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-zinc-900 text-white text-xs rounded-md whitespace-nowrap z-50">
          {statusInfo.text}
          {/* Arrow */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-900" />
        </div>
      )}
    </div>
  );
}
