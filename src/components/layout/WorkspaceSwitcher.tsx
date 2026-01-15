import React from "react";
import {
    Settings,
    LogOut,
    Monitor,
    ChevronDown,
    Calendar,
    StickyNote,
    Globe,
    MoreHorizontal,
    Users,
    ChevronRight,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useGithubSyncStore } from "@/stores/useGithubSyncStore";
import { useProStatusStore } from "@/stores/useProStatusStore";
import { useUIStore } from "@/stores/uiSlice";
import { cn, iconButtonStyles } from "@/lib/utils";
import { isTauri } from "@/lib/storage/adapter";

interface WorkspaceSwitcherProps {
    onOpenSettings?: () => void;
}

export function WorkspaceSwitcher({ onOpenSettings }: WorkspaceSwitcherProps) {
    const {
        isConnected: isGithubConnected,
        username: githubUsername,
        avatarUrl: githubAvatarUrl,
        connect,
        disconnect,
        isConnecting,
        cancelConnect
    } = useGithubSyncStore();
    const { isProUser, isChecking: isProChecking } = useProStatusStore();
    const { appViewMode, toggleAppViewMode } = useUIStore();
    const [isOpen, setIsOpen] = React.useState(false);

    // Fallback data
    const displayName = githubUsername || "NekoTick";

    // Use logo as fallback when no avatar available
    const displayAvatar = githubAvatarUrl || "/logo.png";

    const handleLogout = async () => {
        await disconnect();
        setIsOpen(false);
    };

    const handleLogin = async () => {
        await connect();
    };

    const handleSwitchAccount = async () => {
        setIsOpen(false);
        await connect();
    };

    const handleOpenSettings = () => {
        onOpenSettings?.();
        setIsOpen(false);
    };

    const handleUpgradePlan = async () => {
        const url = "https://nekotick.com/pricing";
        if (isDesktop) {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
            await openUrl(url);
        } else {
            window.open(url, "_blank");
        }
    };

    const handleToggleView = () => {
        toggleAppViewMode();
    };

    const handleOpenAppLink = async () => {
        const isDesktop = isTauri();
        const url = isDesktop ? "https://app.nekotick.com" : "https://nekotick.com";

        if (isDesktop) {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
            await openUrl(url);
        } else {
            window.open(url, "_blank");
        }
        setIsOpen(false);
    };

    const isDesktop = isTauri();

    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);

    // Reset user menu when popover closes
    React.useEffect(() => {
        if (!isOpen) {
            setIsUserMenuOpen(false);
        }
    }, [isOpen]);

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
                    {/* Avatar */}
                    <img
                        src={displayAvatar}
                        alt={displayName}
                        className="w-5 h-5 rounded-sm object-cover shadow-sm"
                    />

                    <span className="text-[14px] font-medium truncate max-w-[120px]">
                        {displayName}
                    </span>

                    <ChevronDown className="w-3.5 h-3.5 text-[var(--neko-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className={cn(
                        "w-[260px] z-50 rounded-xl p-1.5 select-none",
                        "bg-[var(--neko-bg-primary)] dark:bg-zinc-900",
                        "border border-[var(--neko-border)] shadow-xl",
                        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                        "data-[side=bottom]:slide-in-from-top-2"
                    )}
                    sideOffset={8}
                    align="start"
                >
                    {/* Main Content Area */}
                    <div className="flex flex-col">

                        {/* 1. Unauthenticated vs Authenticated Views */}
                        {!isGithubConnected ? (
                            /* New "Apple-style" Login Banner (User likes this) */
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
                                        <ChevronRight className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover:text-[var(--neko-text-primary)] transition-colors opacity-50 group-hover:opacity-100" />
                                    )}
                                </div>
                                <div className="h-[1px] bg-[var(--neko-border)] mx-2 mt-2 opacity-40" />
                            </div>
                        ) : (
                            /* Old "Classic" Authenticated View (User wants this back) */
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
                                            <MoreHorizontal className="w-3.5 h-3.5 text-[var(--neko-text-secondary)]" />
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
                                            <Settings className="w-3 h-3 opacity-60 group-hover/settings:opacity-100 transition-opacity" />
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
                                                <Users className="w-3.5 h-3.5" />
                                                Switch Account
                                            </button>
                                            <button
                                                onClick={handleLogout}
                                                className={cn(
                                                    "flex items-center gap-2 px-2 py-1.5 rounded-md w-full text-left text-[12px] font-medium transition-colors",
                                                    iconButtonStyles
                                                )}
                                            >
                                                <LogOut className="w-3.5 h-3.5" />
                                                Log out
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Divider for Authenticated View Only (if needed, but old design had structure gap) */}
                        {isGithubConnected && <div className="h-[1px] bg-[var(--neko-border)] mx-3 my-1 opacity-50" />}

                        {/* 2. Menu Items (Settings removed as it's in the auth card, or only for unauth? User said 'Restore Auth', implying unauth stays new. Let's keep Settings implicit or remove.) */}
                        {/* Actually, for Unauth, they might need settings? But let's follow the 'Old' pattern where Settings was Auth-only or hidden. */}

                        <div className="px-1.5 pb-1.5 pt-0.5 space-y-0.5">
                            {/* Settings Option - Only for Unauthenticated Users (Auth users have it in card) */}
                            {!isGithubConnected && (
                                <button
                                    onClick={handleOpenSettings}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors group/item",
                                        "hover:bg-[var(--neko-hover)]"
                                    )}
                                >
                                    <Settings className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover/item:text-[var(--neko-text-primary)] transition-colors" />
                                    <span className="text-[13px] font-medium text-[var(--neko-text-secondary)] group-hover/item:text-[var(--neko-text-primary)]">Settings</span>
                                </button>
                            )}

                            <button
                                onClick={handleToggleView}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors group/item",
                                    "hover:bg-[var(--neko-hover)]"
                                )}
                            >
                                {appViewMode === 'calendar' ? (
                                    <>
                                        <StickyNote className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover/item:text-[var(--neko-text-primary)] transition-colors" />
                                        <span className="text-[13px] font-medium text-[var(--neko-text-secondary)] group-hover/item:text-[var(--neko-text-primary)]">Switch to Notes</span>
                                    </>
                                ) : (
                                    <>
                                        <Calendar className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover/item:text-[var(--neko-text-primary)] transition-colors" />
                                        <span className="text-[13px] font-medium text-[var(--neko-text-secondary)] group-hover/item:text-[var(--neko-text-primary)]">Switch to Calendar</span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleOpenAppLink}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors group/item",
                                    "hover:bg-[var(--neko-hover)]"
                                )}
                            >
                                {isDesktop ? (
                                    <>
                                        <Globe className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover/item:text-[var(--neko-text-primary)] transition-colors" />
                                        <span className="text-[13px] font-medium text-[var(--neko-text-secondary)] group-hover/item:text-[var(--neko-text-primary)]">Open Web Version</span>
                                    </>
                                ) : (
                                    <>
                                        <Monitor className="w-4 h-4 text-[var(--neko-text-tertiary)] group-hover/item:text-[var(--neko-text-primary)] transition-colors" />
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
}
