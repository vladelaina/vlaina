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
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useGithubSyncStore } from "@/stores/useGithubSyncStore";
import { useLicenseStore } from "@/stores/useLicenseStore";
import { useUIStore } from "@/stores/uiSlice";
import { cn, iconButtonStyles } from "@/lib/utils";
import { isTauri } from "@/lib/storage/adapter";

interface WorkspaceSwitcherProps {
    onOpenSettings?: () => void;
}

export function WorkspaceSwitcher({ onOpenSettings }: WorkspaceSwitcherProps) {
    const {
        username: githubUsername,
        avatarUrl: githubAvatarUrl,
        isConnected: isGithubConnected,
        disconnect,
        connect,
    } = useGithubSyncStore();
    const { isProUser } = useLicenseStore();
    const { appViewMode, toggleAppViewMode } = useUIStore();
    const [isOpen, setIsOpen] = React.useState(false);

    // Fallback data
    const displayName = githubUsername || "NekoTick";

    // Use logo as fallback when no avatar available
    const displayAvatar = githubAvatarUrl || "/logo.png";

    const handleLogout = () => {
        disconnect();
        setIsOpen(false);
    };

    const handleLogin = () => {
        connect();
        setIsOpen(false);
    };

    const handleOpenSettings = () => {
        onOpenSettings?.();
        setIsOpen(false);
    };

    const handleToggleView = () => {
        toggleAppViewMode();
        setIsOpen(false);
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
                        "w-[260px] z-50 rounded-xl p-1.5",
                        "bg-[var(--neko-bg-primary)] dark:bg-zinc-900",
                        "border border-[var(--neko-border)] shadow-xl",
                        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                        "data-[side=bottom]:slide-in-from-top-2"
                    )}
                    sideOffset={8}
                    align="start"
                >
                    {/* Header: User Info & More Options */}
                    <div className="relative px-3 pt-3 pb-2.5 flex items-start gap-3 group select-none">
                        {/* Avatar Column */}
                        <div className="relative mt-0.5">
                            <img
                                src={displayAvatar}
                                alt={displayName}
                                className="w-9 h-9 rounded-md shadow-sm border border-[var(--neko-border)]"
                            />
                            {isProUser && (
                                <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-[8px] px-1 rounded-full font-bold text-black border border-white ring-1 ring-black/5 dark:ring-white/10">
                                    PRO
                                </div>
                            )}
                        </div>

                        {/* Info & Actions Column */}
                        <div className="flex flex-col flex-1 gap-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <span className="text-[13px] font-semibold text-[var(--neko-text-primary)] leading-none truncate pr-2">
                                    {displayName}
                                </span>
                                {/* More Actions Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsUserMenuOpen(!isUserMenuOpen);
                                    }}
                                    className={cn(
                                        "flex items-center justify-center w-5 h-5 rounded-md -mr-1",
                                        iconButtonStyles,
                                        isUserMenuOpen && "text-[var(--neko-text-primary)]"
                                    )}
                                >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-1.5 leading-none">
                                <span className="text-[11px] text-[var(--neko-text-tertiary)] font-medium">
                                    {isProUser ? "Pro Plan" : "Free Plan"}
                                </span>

                                <span className="text-[var(--neko-text-tertiary)] opacity-30 text-[10px]">·</span>

                                <button
                                    onClick={handleOpenSettings}
                                    className={cn(
                                        "flex items-center gap-1 px-1 py-0.5 rounded transition-colors group/settings",
                                        "text-[11px] font-medium",
                                        iconButtonStyles
                                    )}
                                >
                                    <Settings className="w-3 h-3 transition-opacity opacity-60 group-hover/settings:opacity-100" />
                                    Settings
                                </button>
                            </div>
                        </div>

                        {/* User Menu Dropdown - AFFINE Style (Below dots, slight overlap) */}
                        {isUserMenuOpen && (
                            <>
                                {/* Backdrop to close menu */}
                                <div
                                    className="fixed inset-0 z-[60]"
                                    onClick={() => setIsUserMenuOpen(false)}
                                />
                                <div className="absolute left-[calc(100%-10px)] top-8 z-[70] w-40 p-1 rounded-lg bg-[var(--neko-bg-primary)] border border-[var(--neko-border)] shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-1">
                                    <button
                                        disabled
                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md w-full text-left text-[12px] font-medium text-[var(--neko-text-tertiary)] opacity-50 cursor-not-allowed"
                                    >
                                        <Users className="w-3.5 h-3.5" />
                                        Switch Account
                                    </button>
                                    <div className="h-[1px] bg-[var(--neko-border)] my-1 opacity-50" />
                                    {isGithubConnected ? (
                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded-md w-full text-left text-[12px] font-medium text-[var(--neko-text-secondary)] hover:bg-[var(--neko-hover)] transition-colors"
                                        >
                                            <LogOut className="w-3.5 h-3.5" />
                                            Log out
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleLogin}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded-md w-full text-left text-[12px] font-medium text-[var(--neko-text-primary)] hover:bg-[var(--neko-hover)] transition-colors"
                                        >
                                            <LogOut className="w-3.5 h-3.5 rotate-180" />
                                            Connect GitHub
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="h-[1px] bg-[var(--neko-border)] my-1 mx-1.5 opacity-50" />

                    {/* App View Switching */}
                    <div className="px-1 py-0.5 space-y-0.5">
                        <button
                            onClick={handleToggleView}
                            className={cn(
                                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md w-full text-left font-medium text-[13px]",
                                iconButtonStyles
                            )}
                        >
                            {appViewMode === 'calendar' ? (
                                <>
                                    <StickyNote className="w-4 h-4" />
                                    Switch to Notes
                                </>
                            ) : (
                                <>
                                    <Calendar className="w-4 h-4" />
                                    Switch to Calendar
                                </>
                            )}
                        </button>
                    </div>

                    <div className="h-[1px] bg-[var(--neko-border)] my-1 mx-1.5 opacity-50" />

                    {/* App Links */}
                    <div className="px-1 py-0.5 space-y-0.5">
                        <button
                            onClick={handleOpenAppLink}
                            className={cn(
                                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md w-full text-left font-medium text-[13px]",
                                iconButtonStyles
                            )}
                        >
                            {isDesktop ? (
                                <>
                                    <Globe className="w-4 h-4" />
                                    Open Web Version
                                </>
                            ) : (
                                <>
                                    <Monitor className="w-4 h-4" />
                                    Get Desktop App
                                </>
                            )}
                        </button>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root >
    );
}
