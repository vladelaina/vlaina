import React, { useState } from "react";
import { Icon } from "@/components/ui/icons";
import { openExternalHref } from "@/lib/navigation/externalLinks";
import { cn } from "@/lib/utils";

interface AppMenuProps {
    onOpenSettings: () => void;
    onCloseMenu: () => void;
}

export const AppMenu: React.FC<AppMenuProps> = ({ onOpenSettings, onCloseMenu }) => {
    const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);

    return (
        <div className="px-1.5 pb-1.5 pt-0.5 space-y-0.5">
            <button
                onClick={() => {
                    onOpenSettings();
                    onCloseMenu();
                }}
                className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors group/item",
                    "hover:bg-[var(--vlaina-hover)]"
                )}
            >
                <Icon size="md" name="common.settings" className="text-[var(--vlaina-text-tertiary)] group-hover/item:text-[var(--vlaina-text-primary)] transition-colors" />
                <span className="text-[13px] font-medium text-[var(--vlaina-text-secondary)] group-hover/item:text-[var(--vlaina-text-primary)]">Settings</span>
            </button>

            <div className="h-[1px] bg-[var(--vlaina-border)] mx-3 my-1 opacity-50" />

            <div className="relative px-3 py-2 flex items-center justify-between group/powered">
                <button
                    onClick={() => void openExternalHref("https://vlaina.com")}
                    className="cursor-pointer text-[11px] font-medium text-[var(--vlaina-text-tertiary)] transition-colors hover:text-[var(--vlaina-text-secondary)]"
                >
                    Powered by <span className="text-[var(--vlaina-text-secondary)]">Vlaina</span>
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsLanguageMenuOpen(!isLanguageMenuOpen);
                    }}
                    className={cn(
                        "flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[var(--vlaina-hover)]",
                        isLanguageMenuOpen && "bg-[var(--vlaina-hover)]"
                    )}
                >
                    <Icon size="md" name="common.language" className="text-[var(--vlaina-text-tertiary)]" />
                </button>

                {isLanguageMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsLanguageMenuOpen(false)} />
                        <div className="absolute right-2 bottom-full mb-1 z-[70] w-48 p-1 rounded-lg bg-[var(--vlaina-bg-primary)] border border-[var(--vlaina-border)] shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1">
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
            "hover:bg-[var(--vlaina-hover)]"
        )}
    >
        <div className="flex flex-col">
            <span className="text-[13px] font-medium text-[var(--vlaina-text-primary)]">{label}</span>
            <span className="text-[11px] text-[var(--vlaina-text-tertiary)]">{subLabel}</span>
        </div>
    </button>
);
