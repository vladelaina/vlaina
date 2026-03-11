import React, { useState } from "react";
import { Icon } from "@/components/ui/icons";
import { useGithubSyncStore } from "@/stores/githubSync";
import { useUserAvatar } from "@/hooks/useUserAvatar";
import { cn, iconButtonStyles } from "@/lib/utils";
import { SyncStatusBar } from "./SyncStatusBar";

interface UserIdentityCardProps {
    onLogout: () => void;
    onSwitchAccount: () => void;
}

export const UserIdentityCard: React.FC<UserIdentityCardProps> = ({ onLogout, onSwitchAccount }) => {
    const { username, isConnected } = useGithubSyncStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const displayName = username || "NekoTick";
    const userAvatar = useUserAvatar();
    const displayAvatar = userAvatar || "/logo.png";

    return (
        <div className="relative px-3 pt-3 pb-2.5 flex items-start gap-3 group select-none">
            <div className="flex-shrink-0 relative group/avatar">
                <div className={cn(
                    "w-12 h-12 rounded-lg shadow-sm flex items-center justify-center transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden relative",
                    "bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm",
                    "border border-neutral-200/50 dark:border-zinc-700/50"
                )}>
                    <img
                        src={displayAvatar}
                        alt={displayName}
                        className="w-full h-full object-cover"
                    />
                </div>
                <span
                    className={cn(
                        "absolute -bottom-1 -right-1 text-[8px] px-1.5 py-0.5 rounded-full font-bold border-2 border-[var(--neko-bg-primary)] shadow-sm z-10 select-none",
                        isConnected
                            ? "bg-[#E6F4FF] text-[#007AFF] dark:bg-[#007AFF]/20 dark:text-[#0A84FF]"
                            : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                    )}
                >
                    {isConnected ? "SYNC" : "LOCAL"}
                </span>
            </div>
            <div className="flex flex-col flex-1 gap-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-[var(--neko-text-primary)] leading-none truncate pr-2">
                        {displayName}
                    </span>
                    
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                        className={cn(
                            "flex items-center justify-center w-5 h-5 rounded-md -mr-1 hover:bg-[var(--neko-active)] transition-colors",
                            isMenuOpen && "text-[var(--neko-text-primary)] bg-[var(--neko-active)]"
                        )}
                    >
                        <Icon size="md" name="common.more" className="text-[var(--neko-text-secondary)]" />
                    </button>
                </div>

                <SyncStatusBar />

                {isMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsMenuOpen(false)} />
                        <div className="absolute left-[calc(100%-10px)] top-8 z-[70] w-40 p-1 rounded-lg bg-[var(--neko-bg-primary)] border border-[var(--neko-border)] shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-1">
                            <button
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    onSwitchAccount();
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 rounded-md w-full text-left text-[12px] font-medium transition-colors",
                                    iconButtonStyles
                                )}
                            >
                                <Icon size="md" name="user.switch" />
                                Switch Account
                            </button>
                            <button
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    onLogout();
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 rounded-md w-full text-left text-[12px] font-medium transition-colors",
                                    iconButtonStyles
                                )}
                            >
                                <Icon size="md" name="user.logout" />
                                Log out
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
