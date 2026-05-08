import React, { useState } from "react";
import { Icon } from "@/components/ui/icons";
import { APP_LANGUAGES, SYSTEM_LANGUAGE_PREFERENCE, useI18n } from "@/lib/i18n";
import { openExternalHref } from "@/lib/navigation/externalLinks";
import { cn } from "@/lib/utils";
import { chatComposerPillSurfaceClass } from "@/components/Chat/features/Input/composerStyles";
import {
    getSidebarIdleRowSurfaceClass,
    getSidebarSelectedRowSurfaceClass,
} from "@/components/layout/sidebar/sidebarLabelStyles";

interface AppMenuProps {
    onOpenSettings: () => void;
    onCloseMenu: () => void;
}

export const AppMenu: React.FC<AppMenuProps> = ({ onOpenSettings, onCloseMenu }) => {
    const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
    const { language, languagePreference, setLanguagePreference, t } = useI18n();

    return (
        <div className="px-1.5 pb-1.5 pt-0.5 space-y-0.5">
            <button
                onClick={() => {
                    onOpenSettings();
                    onCloseMenu();
                }}
                className={cn(
                    "flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors group/item",
                    getSidebarIdleRowSurfaceClass('chat')
                )}
            >
                <Icon size="md" name="common.settings" className="text-[var(--chat-sidebar-icon)] transition-colors group-hover/item:text-[var(--chat-sidebar-icon-hover)]" />
                <span className="text-[13px] font-medium">{t('account.settings')}</span>
            </button>

            <div className="h-[1px] bg-[var(--vlaina-border)] mx-3 my-1 opacity-50" />

            <div className="relative px-3 py-2 flex items-center justify-between group/powered">
                <button
                    onClick={() => void openExternalHref("https://vlaina.com")}
                    className="cursor-pointer text-[11px] font-medium text-[var(--vlaina-text-tertiary)] transition-colors hover:text-[var(--vlaina-text-secondary)]"
                >
                    {t('account.poweredBy')} <span className="text-[var(--vlaina-text-secondary)]">vlaina</span>
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
                    aria-label={t('account.language')}
                >
                    <Icon size="md" name="common.language" className="text-[var(--vlaina-text-tertiary)]" />
                </button>

                {isLanguageMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsLanguageMenuOpen(false)} />
                        <div
                            className={cn(
                                "absolute left-full top-[-96px] ml-2 z-[70] max-h-[320px] w-44 overflow-y-auto rounded-[22px] border-transparent p-1 animate-in fade-in-0 zoom-in-95 slide-in-from-left-1",
                                chatComposerPillSurfaceClass
                            )}
                        >
                            {APP_LANGUAGES.map((option) => {
                                const isSystemLanguage = languagePreference === SYSTEM_LANGUAGE_PREFERENCE && language === option.code;
                                return (
                                    <LanguageOption
                                        key={option.code}
                                        label={option.nativeName}
                                        selected={languagePreference === option.code || isSystemLanguage}
                                        trailingLabel={isSystemLanguage ? t('language.current') : undefined}
                                        onClick={() => {
                                            setLanguagePreference(option.code);
                                            setIsLanguageMenuOpen(false);
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const LanguageOption = ({
    label,
    selected,
    trailingLabel,
    onClick,
}: {
    label: string;
    selected: boolean;
    trailingLabel?: string;
    onClick: () => void;
}) => (
    <button
        onClick={onClick}
        className={cn(
            "flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left transition-colors",
            selected
                ? getSidebarSelectedRowSurfaceClass('chat')
                : getSidebarIdleRowSurfaceClass('chat')
        )}
    >
        <div className="flex flex-col">
            <span className={cn("text-[13px] font-medium", selected && "font-[550]")}>{label}</span>
        </div>
        {selected || trailingLabel ? (
            <span className={cn("ml-2 flex shrink-0 items-center gap-1 text-[11px]", selected ? "text-[var(--sidebar-row-selected-text)]" : "text-[var(--vlaina-text-tertiary)]")}>
                {trailingLabel}
                {selected ? <Icon size="sm" name="common.check" /> : null}
            </span>
        ) : null}
    </button>
);
