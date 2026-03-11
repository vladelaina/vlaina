import React from "react";
import { Icon } from "@/components/ui/icons";
import { useGithubSyncStore } from "@/stores/githubSync";
import { useUserAvatar } from "@/hooks/useUserAvatar";
import { cn } from "@/lib/utils";

interface LoginPromptProps {
    onLogin: () => void;
}

export const LoginPrompt: React.FC<LoginPromptProps> = ({ onLogin }) => {
    const { isConnecting, cancelConnect, syncError } = useGithubSyncStore();
    const userAvatar = useUserAvatar();
    const displayAvatar = userAvatar || "/logo.png";

    return (
        <div className="p-2 pb-0">
            <div
                className={cn(
                    "flex items-center gap-3 p-2 w-full rounded-lg transition-colors group text-left relative overflow-hidden",
                    isConnecting ? "bg-[var(--neko-hover)]" : "hover:bg-[var(--neko-hover)] cursor-pointer"
                )}
                onClick={() => !isConnecting && onLogin()}
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
                    <Icon size="md" name="nav.chevronRight" className="text-[var(--neko-text-tertiary)] group-hover:text-[var(--neko-text-primary)] transition-colors opacity-50 group-hover:opacity-100" />
                )}
            </div>
            {syncError ? (
                <div className="mx-2 mt-1 text-[11px] text-red-500 truncate" title={syncError}>
                    {syncError}
                </div>
            ) : null}
            <div className="h-[1px] bg-[var(--neko-border)] mx-2 mt-2 opacity-40" />
        </div>
    );
};
