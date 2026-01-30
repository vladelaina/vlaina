import React, { useMemo, useCallback } from "react";
import {
    MdSettings,
    MdLogout,
    MdMonitor,
    MdExpandMore,
    MdCalendarToday,
    MdDescription,
    MdPublic,
    MdMoreHoriz,
    MdPeople,
    MdChevronRight,
    MdAssignment,
} from "react-icons/md";
import * as Popover from "@radix-ui/react-popover";
import { useGithubSyncStore } from "@/stores/useGithubSyncStore";
import { useProStatusStore } from "@/stores/useProStatusStore";
import { useUIStore } from "@/stores/uiSlice";
import { useUserAvatar } from "@/hooks/useUserAvatar";
import { cn, iconButtonStyles } from "@/lib/utils";
import { isTauri } from "@/lib/storage/adapter";

interface WorkspaceSwitcherProps {
    onOpenSettings?: () => void;
}

const WorkspaceSwitcherBase = ({ onOpenSettings }: WorkspaceSwitcherProps) => {
    const {
        isConnected: isGithubConnected,
        username: githubUsername,
        connect,
        disconnect,
        isConnecting,
        cancelConnect
    } = useGithubSyncStore();
    
    const { isProUser, isChecking: isProChecking } = useProStatusStore();
    const { appViewMode, setAppViewMode } = useUIStore();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);

    // Cache static platform check
    const isDesktop = useMemo(() => isTauri(), []);

    // Memoize handlers to prevent unnecessary re-renders
    const handleLogout = useCallback(async () => {
        await disconnect();
        setIsOpen(false);
    }, [disconnect]);

    const handleLogin = useCallback(async () => {
        await connect();
    }, [connect]);

    const handleSwitchAccount = useCallback(async () => {
        setIsOpen(false);
        await connect();
    }, [connect]);

    const handleOpenSettings = useCallback(() => {
        onOpenSettings?.();
        setIsOpen(false);
    }, [onOpenSettings]);

    const handleUpgradePlan = useCallback(async () => {
        const url = "https://nekotick.com/pricing";
        if (isDesktop) {
            try {
                const { openUrl } = await import('@tauri-apps/plugin-opener');
                await openUrl(url);
            } catch (e) {
                console.error("Failed to open URL:", e);
                window.open(url, "_blank");
            }
        } else {
            window.open(url, "_blank");
        }
    }, [isDesktop]);

    const handleOpenAppLink = useCallback(async () => {
        const url = isDesktop ? "https://app.nekotick.com" : "https://nekotick.com";
        if (isDesktop) {
            try {
                const { openUrl } = await import('@tauri-apps/plugin-opener');
                await openUrl(url);
            } catch (e) {
                window.open(url, "_blank");
            }
        } else {
            window.open(url, "_blank");
        }
        setIsOpen(false);
    }, [isDesktop]);

    // Helper to prioritize menu closing over heavy view rendering
    const handleViewSwitch = useCallback((mode: typeof appViewMode) => {
        if (appViewMode === mode) return;
        setIsOpen(false);
        // Defer state update just enough to let the menu unmount first
        setTimeout(() => {
            setAppViewMode(mode);
        }, 10);
    }, [appViewMode, setAppViewMode]);

    // Reset user menu when popover closes
    React.useEffect(() => {
        if (!isOpen) {
            setIsUserMenuOpen(false);
        }
    }, [isOpen]);

    // Fallback data
    const displayName = githubUsername || "NekoTick";
    const userAvatar = useUserAvatar();
    const displayAvatar = userAvatar || "/logo.png";

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
                <button
                    className={cn(
                        "flex items-center gap-2 px-2 py-1 h-8 rounded-md transition-colors",
                        "hover:bg-[var(--neko-hover)]",
                        "text-[var(--neko-text-primary)] select-none outline-none group",
                        isOpen && "bg-[var(--neko-hover)]"
                    )}
                >
                    <img
                        src={displayAvatar}
                        alt={displayName}
                        className="w-5 h-5 rounded-sm object-cover shadow-sm"
                    />
                    <span className="text-[14px] font-medium truncate max-w-[120px]">
                        {displayName}
                    </span>
                    <MdExpandMore className="w-3.5 h-3.5 text-[var(--neko-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className={cn(
                        "w-[260px] z-50 rounded-xl p-1.5 select-none",
                        "bg-[var(--neko-bg-primary)] dark:bg-zinc-900",
                        "border border-[var(--neko-border)] shadow-xl",
                        // Enter animation only - instant exit for snappy feel
                        "animate-in fade-in-0 zoom-in-95 duration-200",
                        "data-[side=bottom]:slide-in-from-top-2"
                    )}
                    sideOffset={8}
                    align="start"
                >
                    <div className="flex flex-col">
                        {!isGithubConnected ? (
                            <div className="p-2 pb-0">
                                <div
                                    className={cn(
                                        "flex items-center gap-3 p-2 w-full rounded-lg transition-colors group text-left relative overflow-hidden",
                                        isConnecting ? "bg-[var(--neko-hover)]" : "hover:bg-[var(--neko-hover)] cursor-pointer"
                                    )}
                                    onClick={() => !isConnecting && handleLogin()}
                                >
                                    <div className="relative shrink-0 w-10 h-10">
                                        <img
                                            src={displayAvatar}
                                            alt="NekoTick"
                                            className="w-full h-full rounded-lg border border-[var(--neko-border)] shadow-sm object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-semibold text-[14px] leading-tight block text-[var(--neko-text-primary)]">
                                            {isConnecting ? "Finishing in Browser..." : "Sign in to NekoTick"}
                                        </span>
                                        <span className="text-[12px] text-[var(--neko-text-tertiary)] mt-0.5 block leading-tight truncate">
                                            {isConnecting ? "Waiting for authorization" : "Connect GitHub to sync"}
                                        </span>
                                    </div>

                                    {isConnecting ? (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                cancelConnect();
                                            }}
                                            className="px-2.5 py-1 rounded-md bg-[var(--neko-bg-secondary)] hover:bg-[var(--neko-border)] text-[11px] font-medium text-[var(--neko-text-secondary)] transition-colors active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                    ) : (
                                        <MdChevronRight className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover:text-[var(--neko-text-primary)] transition-colors opacity-50 group-hover:opacity-100" />
                                    )}
                                </div>
                                <div className="h-[1px] bg-[var(--neko-border)] mx-2 mt-2 opacity-40" />
                            </div>
                        ) : (
                            <div className="relative px-3 pt-3 pb-2.5 flex items-start gap-3 group select-none">
                                <div className="relative">
                                    <img
                                        src={displayAvatar}
                                        alt={displayName}
                                        className="w-10 h-10 rounded-lg shadow-sm border border-[var(--neko-border)] object-cover"
                                    />
                                    {isProUser && !isProChecking && (
                                        <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-[8px] px-1 rounded-full font-bold text-black border border-white ring-1 ring-black/5 dark:ring-white/10">
                                            PRO
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col flex-1 gap-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[13px] font-semibold text-[var(--neko-text-primary)] leading-none truncate pr-2">
                                            {displayName}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsUserMenuOpen(!isUserMenuOpen);
                                            }}
                                            className={cn(
                                                "flex items-center justify-center w-5 h-5 rounded-md -mr-1 hover:bg-[var(--neko-active)] transition-colors",
                                                isUserMenuOpen && "text-[var(--neko-text-primary)] bg-[var(--neko-active)]"
                                            )}
                                        >
                                            <MdMoreHoriz className="w-3.5 h-3.5 text-[var(--neko-text-secondary)]" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1.5 leading-none h-4">
                                        <div className="flex items-center gap-1.5 h-full min-w-[60px]">
                                            {!isProChecking ? (
                                                <>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUpgradePlan();
                                                        }}
                                                        className="text-[11px] font-medium text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-primary)] transition-colors whitespace-nowrap"
                                                    >
                                                        {isProUser ? "Pro Plan" : "Free Plan"}
                                                    </button>
                                                    <span className="text-[var(--neko-text-tertiary)] opacity-30 text-[10px]">·</span>
                                                </>
                                            ) : (
                                                <div className="w-10 h-2 bg-[var(--neko-border)] rounded-full animate-pulse opacity-40" />
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenSettings();
                                            }}
                                            className="flex items-center gap-1 text-[11px] font-medium text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-primary)] transition-colors group/settings"
                                        >
                                            <MdSettings className="w-3 h-3 opacity-60 group-hover/settings:opacity-100 transition-opacity" />
                                            Settings
                                        </button>
                                    </div>
                                </div>

                                {isUserMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[60]" onClick={() => setIsUserMenuOpen(false)} />
                                        <div className="absolute left-[calc(100%-10px)] top-8 z-[70] w-40 p-1 rounded-lg bg-[var(--neko-bg-primary)] border border-[var(--neko-border)] shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-1">
                                            <button
                                                onClick={handleSwitchAccount}
                                                className={cn(
                                                    "flex items-center gap-2 px-2 py-1.5 rounded-md w-full text-left text-[12px] font-medium transition-colors",
                                                    iconButtonStyles
                                                )}
                                            >
                                                <MdPeople className="w-3.5 h-3.5" />
                                                Switch Account
                                            </button>
                                            <button
                                                onClick={handleLogout}
                                                className={cn(
                                                    "flex items-center gap-2 px-2 py-1.5 rounded-md w-full text-left text-[12px] font-medium transition-colors",
                                                    iconButtonStyles
                                                )}
                                            >
                                                <MdLogout className="w-3.5 h-3.5" />
                                                Log out
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {isGithubConnected && <div className="h-[1px] bg-[var(--neko-border)] mx-3 my-1 opacity-50" />}

                        <div className="px-1.5 pb-1.5 pt-0.5 space-y-0.5">
                            {!isGithubConnected && (
                                <button
                                    onClick={handleOpenSettings}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors group/item",
                                        "hover:bg-[var(--neko-hover)]"
                                    )}
                                >
                                    <MdSettings className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover/item:text-[var(--neko-text-primary)] transition-colors" />
                                    <span className="text-[13px] font-medium text-[var(--neko-text-secondary)] group-hover/item:text-[var(--neko-text-primary)]">Settings</span>
                                </button>
                            )}

                            <div className="flex flex-col gap-0.5 py-1">
                                {appViewMode !== 'calendar' && (
                                    <button
                                        onClick={() => handleViewSwitch('calendar')}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors group/item",
                                            "hover:bg-[var(--neko-hover)]"
                                        )}
                                    >
                                        <MdCalendarToday className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover/item:text-[var(--neko-text-primary)] transition-colors" />
                                        <span className="text-[13px] font-medium text-[var(--neko-text-secondary)] group-hover/item:text-[var(--neko-text-primary)]">Calendar</span>
                                    </button>
                                )}

                                {appViewMode !== 'notes' && (
                                    <button
                                        onClick={() => handleViewSwitch('notes')}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors group/item",
                                            "hover:bg-[var(--neko-hover)]"
                                        )}
                                    >
                                        <MdDescription className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover/item:text-[var(--neko-text-primary)] transition-colors" />
                                        <span className="text-[13px] font-medium text-[var(--neko-text-secondary)] group-hover/item:text-[var(--neko-text-primary)]">Notes</span>
                                    </button>
                                )}

                                {appViewMode !== 'todo' && (
                                    <button
                                        onClick={() => handleViewSwitch('todo')}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors group/item",
                                            "hover:bg-[var(--neko-hover)]"
                                        )}
                                    >
                                        <MdAssignment className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover/item:text-[var(--neko-text-primary)] transition-colors" />
                                        <span className="text-[13px] font-medium text-[var(--neko-text-secondary)] group-hover/item:text-[var(--neko-text-primary)]">Todos</span>
                                    </button>
                                )}
                            </div>

                            <div className="h-[1px] bg-[var(--neko-border)] mx-3 my-1 opacity-50" />

                            <button
                                onClick={handleOpenAppLink}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors group/item",
                                    "hover:bg-[var(--neko-hover)]"
                                )}
                            >
                                {isDesktop ? (
                                    <>
                                        <MdPublic className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover/item:text-[var(--neko-text-primary)] transition-colors" />
                                        <span className="text-[13px] font-medium text-[var(--neko-text-secondary)] group-hover/item:text-[var(--neko-text-primary)]">Open Web Version</span>
                                    </>
                                ) : (
                                    <>
                                        <MdMonitor className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover/item:text-[var(--neko-text-primary)] transition-colors" />
                                        <span className="text-[13px] font-medium text-[var(--neko-text-secondary)] group-hover/item:text-[var(--neko-text-primary)]">Get Desktop App</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root >
    );
};

export const WorkspaceSwitcher = React.memo(WorkspaceSwitcherBase);
WorkspaceSwitcher.displayName = "WorkspaceSwitcher";
