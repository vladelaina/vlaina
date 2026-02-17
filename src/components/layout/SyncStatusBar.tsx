import React, { useCallback, useState, useEffect } from "react";
import { Icon } from "@/components/ui/icons";
import { formatDistanceToNow } from "date-fns";
import { useGithubSyncStore } from "@/stores/useGithubSyncStore";
import { useProStatusStore } from "@/stores/useProStatusStore";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export const SyncStatusBar: React.FC = () => {
    const {
        isConnected,
        isSyncing,
        syncBidirectional,
        lastSyncTime,
        syncError,
        clearError,
        checkStatus,
        checkRemoteData
    } = useGithubSyncStore();
    
    const { isProUser } = useProStatusStore();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showSuccess, setShowSuccess] = useState(false);

    // Refresh status when component mounts (or popover opens)
    useEffect(() => {
        if (isConnected) {
            checkStatus();
            checkRemoteData();
        }
    }, [isConnected, checkStatus, checkRemoteData]);

    // Monitor online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleSync = useCallback(async () => {
        if (!isOnline) return;
        clearError();
        const success = await syncBidirectional();
        if (success) {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        }
    }, [isOnline, clearError, syncBidirectional]);

    return (
        <div className="flex items-center gap-1.5 h-[18px] min-w-[60px]">
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSync();
                        }}
                        disabled={isSyncing || !isOnline}
                        className={cn(
                            "group/sync flex items-center gap-1.5 text-[11px] font-medium transition-colors w-full",
                            !isOnline ? "text-[var(--neko-text-tertiary)] opacity-50 cursor-not-allowed" : "text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-primary)] cursor-pointer"
                        )}
                    >
                        <span className={cn(
                            "flex items-center justify-center w-3 h-3 transition-all duration-300",
                            isSyncing && "animate-spin text-[var(--neko-accent)]",
                            showSuccess && "text-green-500 scale-110",
                            !isSyncing && !showSuccess && !syncError && isOnline && isProUser && "text-[var(--neko-accent)]",
                            syncError && "text-red-500",
                            !isOnline && "text-[var(--neko-text-tertiary)]"
                        )}>
                            {showSuccess ? (
                                <Icon name="common.check" className="w-3 h-3" />
                            ) : !isOnline ? (
                                <Icon name="common.blocked" className="w-3 h-3" />
                            ) : isSyncing ? (
                                <Icon name="common.refresh" className="w-3 h-3" />
                            ) : syncError ? (
                                <Icon name="common.error" className="w-3 h-3" />
                            ) : isProUser ? (
                                <Icon name="common.cloud" className="w-3 h-3" />
                            ) : (
                                <Icon name="common.refresh" className="w-3 h-3 transition-transform group-hover/sync:rotate-180" />
                            )}
                        </span>
                        <span className={cn(
                            "truncate max-w-[140px]",
                            syncError && "text-red-500",
                            showSuccess && "text-green-500"
                        )}>
                            {showSuccess
                                ? "Done"
                                : !isOnline 
                                    ? "Offline"
                                    : isSyncing 
                                        ? "Syncing..." 
                                        : syncError
                                            ? "Sync failed"
                                            : lastSyncTime 
                                                ? formatDistanceToNow(lastSyncTime * 1000, { addSuffix: true })
                                                : "Sync now"
                            }
                        </span>
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px] break-words">
                    {!isOnline 
                        ? "Please check your internet connection" 
                        : syncError 
                            ? syncError 
                            : showSuccess 
                                ? "Data is up to date" 
                                : "Synchronize your notes and settings"}
                </TooltipContent>
            </Tooltip>
        </div>
    );
};
