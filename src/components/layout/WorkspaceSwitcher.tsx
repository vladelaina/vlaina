import React from "react";
import {
    Settings,
    LogOut,
    Check,
    Plus,
    Monitor,
    User,
    ChevronDown,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useGithubSyncStore } from "@/stores/useGithubSyncStore";
import { useLicenseStore } from "@/stores/useLicenseStore";
import { cn } from "@/lib/utils";

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
    const [isOpen, setIsOpen] = React.useState(false);

    // Fallback data
    const displayName = githubUsername || "NekoTick";
    const displayEmail = isGithubConnected
        ? `${displayName}@nekotick.com` // Mock email for now since we don't store it publicly
        : "Local User";

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
                    {/* Header Section: Current Account Info */}
                    <div className="flex flex-col gap-1 p-2 mb-1">
                        <div className="flex items-center justify-between text-[11px] text-[var(--neko-text-tertiary)] px-1">
                            <span>{displayEmail}</span>
                            <span className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_4px_2px_rgba(34,197,94,0.2)]" />
                        </div>
                    </div>

                    {/* Active Workspace Card */}
                    <div className="mx-1 mb-2 p-3 bg-[var(--neko-bg-secondary)] rounded-lg flex items-center justify-between group cursor-default">
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
                                    {isProUser ? "Pro Plan" : "Free Plan"} · 1 member
                                </span>
                            </div>
                        </div>
                        <Check className="w-4 h-4 text-[var(--neko-text-primary)]" />
                    </div>

                    {/* Menu Items */}
                    <div className="flex flex-col gap-0.5 px-0.5">
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

                        {/* Mock "Invite members" for premium feel */}
                        <button
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-1.5 rounded-md w-full text-left",
                                "text-[13px] text-[var(--neko-text-primary)]",
                                "hover:bg-[var(--neko-hover)] transition-colors opacity-80"
                            )}
                        >
                            <User className="w-4 h-4 text-[var(--neko-text-tertiary)]" />
                            Invite members
                        </button>
                    </div>

                    <div className="h-[1px] bg-[var(--neko-border)] my-1.5 mx-2" />

                    {/* "Switch Account" Section Placeholder */}
                    <div className="flex flex-col gap-0.5 px-0.5">
                        <button
                            className={cn(
                                "flex items-center justify-between px-3 py-1.5 rounded-md w-full text-left",
                                "text-[13px] text-[var(--neko-text-primary)]",
                                "hover:bg-[var(--neko-hover)] transition-colors opacity-70 cursor-not-allowed"
                            )}
                            disabled
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-4 h-4 rounded-full border border-[var(--neko-text-tertiary)] border-dashed flex items-center justify-center">
                                    <Plus className="w-2.5 h-2.5 text-[var(--neko-text-tertiary)]" />
                                </div>
                                Create work account
                            </div>
                        </button>
                        <button
                            className={cn(
                                "flex items-center justify-between px-3 py-1.5 rounded-md w-full text-left",
                                "text-[13px] text-[var(--neko-text-primary)]",
                                "hover:bg-[var(--neko-hover)] transition-colors opacity-70 cursor-not-allowed"
                            )}
                            disabled
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-4 h-4 rounded-full border border-[var(--neko-text-tertiary)] border-dashed flex items-center justify-center">
                                    <Plus className="w-2.5 h-2.5 text-[var(--neko-text-tertiary)]" />
                                </div>
                                Add another account
                            </div>
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
                                <LogOut className="w-4 h-4 text-[var(--neko-text-tertiary)]" />
                                Log in
                            </button>
                        )}
                    </div>

                    <div className="h-[1px] bg-[var(--neko-border)] my-1.5 mx-2" />

                    {/* Footer App Link */}
                    <div className="px-0.5 pb-0.5">
                        <button
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-1.5 rounded-md w-full text-left",
                                "text-[13px] text-[var(--neko-text-primary)]",
                                "hover:bg-[var(--neko-hover)] transition-colors"
                            )}
                        >
                            <Monitor className="w-4 h-4 text-[var(--neko-text-tertiary)]" />
                            Get Windows app
                        </button>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root >
    );
}
