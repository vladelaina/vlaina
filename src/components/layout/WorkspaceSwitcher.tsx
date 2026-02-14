import React, { useMemo, useCallback } from "react";
import { Icon } from "@/components/ui/icons";
import * as Popover from "@radix-ui/react-popover";
import { useGithubSyncStore } from "@/stores/useGithubSyncStore";
import { useUserAvatar } from "@/hooks/useUserAvatar";
import { cn } from "@/lib/utils";
import { LoginPrompt } from "./LoginPrompt";
import { UserIdentityCard } from "./UserIdentityCard";
import { AppNavigation } from "./AppNavigation";
import { AppMenu } from "./AppMenu";

interface WorkspaceSwitcherProps {
    onOpenSettings?: () => void;
}

const WorkspaceSwitcherBase = ({ onOpenSettings }: WorkspaceSwitcherProps) => {
    const {
        isConnected: isGithubConnected,
        username: githubUsername,
        connect,
        disconnect,
    } = useGithubSyncStore();
    
    const [isOpen, setIsOpen] = React.useState(false);
    const [tooltipsEnabled, setTooltipsEnabled] = React.useState(false);

    // Enable tooltips after a short delay when popover opens
    React.useEffect(() => {
        if (isOpen) {
            setTooltipsEnabled(false);
            const timer = setTimeout(() => {
                setTooltipsEnabled(true);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setTooltipsEnabled(false);
        }
    }, [isOpen]);

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

    // Fallback data for trigger button
    const displayName = githubUsername || "NekoTick";
    const userAvatar = useUserAvatar();
    const displayAvatar = userAvatar || "/logo.png";

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
                <button
                    className={cn(
                        "flex items-center gap-1.5 px-1.5 py-1 h-8 rounded-md transition-colors",
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
                    <span className="text-[13px] font-medium truncate max-w-[120px] leading-none pt-[1px]">
                        {displayName}
                    </span>
                    <Icon name="nav.chevronDown" className="w-3.5 h-3.5 text-[var(--neko-text-tertiary)] opacity-0 group-hover:opacity-70 transition-all duration-200 -ml-0.5" />
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className={cn(
                        "w-[260px] z-50 rounded-xl p-1.5 select-none",
                        "bg-[var(--neko-bg-primary)] dark:bg-zinc-900",
                        "border border-[var(--neko-border)] shadow-xl",
                        "animate-in fade-in-0 zoom-in-95 duration-200",
                        "data-[side=bottom]:slide-in-from-top-2"
                    )}
                    sideOffset={8}
                    align="start"
                >
                    <div className="flex flex-col">
                        {!isGithubConnected ? (
                            <LoginPrompt onLogin={handleLogin} />
                        ) : (
                            <UserIdentityCard 
                                onLogout={handleLogout} 
                                onSwitchAccount={handleSwitchAccount} 
                            />
                        )}

                        {isGithubConnected && <div className="h-[1px] bg-[var(--neko-border)] mx-3 my-1 opacity-50" />}

                        <AppNavigation 
                            onCloseMenu={() => setIsOpen(false)} 
                            tooltipsEnabled={tooltipsEnabled} 
                        />

                        <div className="h-[1px] bg-[var(--neko-border)] mx-3 my-1 opacity-50" />

                        <AppMenu 
                            onOpenSettings={handleOpenSettings}
                            onCloseMenu={() => setIsOpen(false)}
                        />
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root >
    );
};

export const WorkspaceSwitcher = React.memo(WorkspaceSwitcherBase);
WorkspaceSwitcher.displayName = "WorkspaceSwitcher";
