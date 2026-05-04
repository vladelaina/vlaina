import React, { useState } from "react";
import { Icon } from "@/components/ui/icons";
import { APP_LANGUAGES, SYSTEM_LANGUAGE_PREFERENCE, useI18n } from "@/lib/i18n";
import { openExternalHref } from "@/lib/navigation/externalLinks";
import { cn } from "@/lib/utils";

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
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors group/item",
                    "hover:bg-[var(--vlaina-hover)]"
                )}
            >
                <Icon size="md" name="common.settings" className="text-[var(--vlaina-text-tertiary)] group-hover/item:text-[var(--vlaina-text-primary)] transition-colors" />
                <span className="text-[13px] font-medium text-[var(--vlaina-text-secondary)] group-hover/item:text-[var(--vlaina-text-primary)]">{t('account.settings')}</span>
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
                        <div className="absolute right-2 bottom-full mb-1 z-[70] max-h-[320px] w-56 overflow-y-auto rounded-lg border border-[var(--vlaina-border)] bg-[var(--vlaina-bg-primary)] p-1 shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1">
                            <LanguageOption
                                label={t('language.system')}
                                subLabel={t('language.systemDescription')}
                                selected={languagePreference === SYSTEM_LANGUAGE_PREFERENCE}
                                onClick={() => {
                                    setLanguagePreference(SYSTEM_LANGUAGE_PREFERENCE);
                                    setIsLanguageMenuOpen(false);
                                }}
                            />
                            <div className="my-1 h-[1px] bg-[var(--vlaina-border)] opacity-50" />
                            {APP_LANGUAGES.map((option) => (
                                <LanguageOption
                                    key={option.code}
                                    label={option.nativeName}
                                    subLabel={option.englishName}
                                    selected={languagePreference === option.code}
                                    trailingLabel={languagePreference === SYSTEM_LANGUAGE_PREFERENCE && language === option.code ? t('language.current') : undefined}
                                    onClick={() => {
                                        setLanguagePreference(option.code);
                                        setIsLanguageMenuOpen(false);
                                    }}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const LanguageOption = ({
    label,
    subLabel,
    selected,
    trailingLabel,
    onClick,
}: {
    label: string;
    subLabel: string;
    selected: boolean;
    trailingLabel?: string;
    onClick: () => void;
}) => (
    <button
        onClick={onClick}
        className={cn(
            "flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left transition-colors",
            "hover:bg-[var(--vlaina-hover)]",
            selected && "bg-[var(--vlaina-hover)]"
        )}
    >
        <div className="flex flex-col">
            <span className="text-[13px] font-medium text-[var(--vlaina-text-primary)]">{label}</span>
            <span className="text-[11px] text-[var(--vlaina-text-tertiary)]">{subLabel}</span>
        </div>
        {selected || trailingLabel ? (
            <span className="ml-2 flex shrink-0 items-center gap-1 text-[11px] text-[var(--vlaina-text-tertiary)]">
                {trailingLabel}
                {selected ? <Icon size="sm" name="common.check" /> : null}
            </span>
        ) : null}
    </button>
);
