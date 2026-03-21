import React, { useCallback, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { isTauri } from "@/lib/storage/adapter";

interface AppMenuProps {
    onOpenSettings: () => void;
    onCloseMenu: () => void;
}

export const AppMenu: React.FC<AppMenuProps> = ({ onOpenSettings, onCloseMenu }) => {
    const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
    
    const isDesktop = useMemo(() => isTauri(), []);

    const handleOpenWebsite = useCallback(async () => {
        const url = "https://nekotick.com";
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

    return (
        <div className="px-1.5 pb-1.5 pt-0.5 space-y-0.5">
            <button
                onClick={() => {
                    onOpenSettings();
                    onCloseMenu();
                }}
                className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors group/item",
                    "hover:bg-[var(--neko-hover)]"
                )}
            >
                <Icon size="md" name="common.settings" className="text-[var(--neko-text-tertiary)] group-hover/item:text-[var(--neko-text-primary)] transition-colors" />
                <span className="text-[13px] font-medium text-[var(--neko-text-secondary)] group-hover/item:text-[var(--neko-text-primary)]">Settings</span>
            </button>

            <div className="h-[1px] bg-[var(--neko-border)] mx-3 my-1 opacity-50" />

            <div className="relative px-3 py-2 flex items-center justify-between group/powered">
                <button
                    onClick={handleOpenWebsite}
                    className="cursor-pointer text-[11px] font-medium text-[var(--neko-text-tertiary)] transition-colors hover:text-[var(--neko-text-secondary)]"
                >
                    Powered by <span className="text-[var(--neko-text-secondary)]">NekoTick</span>
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsLanguageMenuOpen(!isLanguageMenuOpen);
                    }}
                    className={cn(
                        "flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[var(--neko-hover)]",
                        isLanguageMenuOpen && "bg-[var(--neko-hover)]"
                    )}
                >
                    <Icon size="md" name="common.language" className="text-[var(--neko-text-tertiary)]" />
                </button>

                {isLanguageMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsLanguageMenuOpen(false)} />
                        <div className="absolute right-2 bottom-full mb-1 z-[70] w-48 p-1 rounded-lg bg-[var(--neko-bg-primary)] border border-[var(--neko-border)] shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1">
                            <LanguageOption 
                                label="English" 
                                subLabel="英语" 
                                onClick={() => setIsLanguageMenuOpen(false)} 
                            />
                            <LanguageOption 
                                label="简体中文" 
                                subLabel="简体中文" 
                                onClick={() => setIsLanguageMenuOpen(false)} 
                            />
                            <LanguageOption 
                                label="繁體中文" 
                                subLabel="繁体中文" 
                                onClick={() => setIsLanguageMenuOpen(false)} 
                            />
                            <LanguageOption 
                                label="日本語" 
                                subLabel="日语" 
                                onClick={() => setIsLanguageMenuOpen(false)} 
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const LanguageOption = ({ label, subLabel, onClick }: { label: string; subLabel: string; onClick: () => void }) => (
    <button
        onClick={onClick}
        className={cn(
            "flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left transition-colors",
            "hover:bg-[var(--neko-hover)]"
        )}
    >
        <div className="flex flex-col">
            <span className="text-[13px] font-medium text-[var(--neko-text-primary)]">{label}</span>
            <span className="text-[11px] text-[var(--neko-text-tertiary)]">{subLabel}</span>
        </div>
    </button>
);
