import React from "react";
import {
    Settings,
    LogOut,
    Check,
    Monitor,
    ChevronDown,
    Calendar,
    StickyNote,
    Globe,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useGithubSyncStore } from "@/stores/useGithubSyncStore";
import { useLicenseStore } from "@/stores/useLicenseStore";
import { useUIStore } from "@/stores/uiSlice";
import { cn } from "@/lib/utils";
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

    // Use logo for logged out state, valid avatar url for logged in, or undefined (render initial)
    const displayAvatar = isGithubConnected
        ? (githubAvatarUrl || undefined)
        : "/logo.png";

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

                    {/* Avatar logic */}
                    {displayAvatar ? (
                        <img
                            src={displayAvatar}
                            alt={displayName}
                            className="w-5 h-5 rounded-sm object-cover shadow-sm"
                        />
                    ) : (
                        <div className="w-5 h-5 rounded-sm bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold shadow-sm">
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                    )}

                    <span className="text-[14px] font-medium truncate max-w-[120px]">
                        {displayName}
                    </span>

                    <ChevronDown className="w-3.5 h-3.5 text-[var(--neko-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className={cn(
                        "w-[340px] z-50 rounded-xl p-1",
                        "bg-[var(--neko-bg-primary)] dark:bg-zinc-900",
                        "border border-[var(--neko-border)] shadow-xl",
                        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                        "data-[side=bottom]:slide-in-from-top-2"
                    )}
                    sideOffset={8}
                    align="start"
                >
                    {/* Active Workspace Card */}
                    <div className="mx-1 mt-1 mb-2 p-3 bg-[var(--neko-bg-secondary)] rounded-lg flex items-center justify-between group cursor-default">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <img
                                    src={displayAvatar}
                                    alt={displayName}
                                    className="w-9 h-9 rounded shadow-sm border border-[var(--neko-border)]"
                                />
                                {isProUser && (
                                    <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-[8px] px-1 rounded-full font-bold text-black border border-white">
                                        PRO
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[13px] font-medium text-[var(--neko-text-primary)]">
                                    {displayName}
                                </span>
                                <span className="text-[11px] text-[var(--neko-text-secondary)]">
                                    {isProUser ? "Pro Plan" : "Free Plan"}
                                </span>
                            </div>
                        </div>
                        <Check className="w-4 h-4 text-[var(--neko-text-primary)]" />
                    </div>

                    {/* Menu Items */}
                    <div className="flex flex-col gap-0.5 px-0.5">
                        <button
                            onClick={handleToggleView}
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-1.5 rounded-md w-full text-left",
                                "text-[13px] text-[var(--neko-text-primary)]",
                                "hover:bg-[var(--neko-hover)] transition-colors"
                            )}
                        >
                            {appViewMode === 'calendar' ? (
                                <>
                                    <StickyNote className="w-4 h-4 text-[var(--neko-text-tertiary)]" />
                                    Switch to Notes
                                </>
                            ) : (
                                <>
                                    <Calendar className="w-4 h-4 text-[var(--neko-text-tertiary)]" />
                                    Switch to Calendar
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleOpenSettings}
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-1.5 rounded-md w-full text-left",
                                "text-[13px] text-[var(--neko-text-primary)]",
                                "hover:bg-[var(--neko-hover)] transition-colors"
                            )}
                        >
                            <Settings className="w-4 h-4 text-[var(--neko-text-tertiary)]" />
                            Settings
                        </button>
                    </div>

                    <div className="h-[1px] bg-[var(--neko-border)] my-1.5 mx-2" />

                    {/* Logout Section */}
                    <div className="px-0.5">
                        {isGithubConnected ? (
                            <button
                                onClick={handleLogout}
                                className={cn(
                                    "flex items-center gap-2.5 px-3 py-1.5 rounded-md w-full text-left",
                                    "text-[13px] text-[var(--neko-text-primary)]",
                                    "hover:bg-[var(--neko-hover)] transition-colors"
                                )}
                            >
                                <LogOut className="w-4 h-4 text-[var(--neko-text-tertiary)]" />
                                Log out
                            </button>
                        ) : (
                            <button
                                onClick={handleLogin}
                                className={cn(
                                    "flex items-center gap-2.5 px-3 py-1.5 rounded-md w-full text-left",
                                    "text-[13px] text-[var(--neko-text-primary)]",
                                    "hover:bg-[var(--neko-hover)] transition-colors"
                                )}
                            >
                                <LogOut className="w-4 h-4 text-[var(--neko-text-tertiary)] rotate-180" />
                                Connect GitHub
                            </button>
                        )}
                    </div>

                    <div className="h-[1px] bg-[var(--neko-border)] my-1.5 mx-2" />

                    {/* Footer App Link */}
                    <div className="px-0.5 pb-0.5">
                        <button
                            onClick={handleOpenAppLink}
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-1.5 rounded-md w-full text-left",
                                "text-[13px] text-[var(--neko-text-primary)]",
                                "hover:bg-[var(--neko-hover)] transition-colors"
                            )}
                        >
                            {isDesktop ? (
                                <>
                                    <Globe className="w-4 h-4 text-[var(--neko-text-tertiary)]" />
                                    Open Web App
                                </>
                            ) : (
                                <>
                                    <Monitor className="w-4 h-4 text-[var(--neko-text-tertiary)]" />
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
