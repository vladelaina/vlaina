import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { useI18n } from '@/lib/i18n';
import { themeDomStyleTokens, themeMotionTokens } from '@/styles/themeTokens';

interface SegmentedControlProps {
    options: { value: string; label: string; icon?: ReactNode }[];
    value: string;
    onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
    return (
        <div className="flex p-0.5 bg-[var(--vlaina-color-setting-control)] rounded-lg border border-[var(--vlaina-color-menu-border)]">
            {options.map((option) => {
                const isActive = value === option.value;
                return (
                    <button
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "relative flex items-center justify-center gap-2 px-3 py-1.5 text-[var(--vlaina-font-13)] font-medium rounded-[var(--vlaina-radius-6px)] transition-all z-[var(--vlaina-z-10)] flex-1",
                            isActive
                                ? "text-[var(--vlaina-sidebar-row-selected-text)]"
                                : "text-[var(--vlaina-sidebar-chat-text)] hover:text-[var(--vlaina-sidebar-chat-text)]"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="segmented-bg"
                                className="absolute inset-0 bg-[var(--vlaina-color-setting-control-active)] rounded-[var(--vlaina-radius-6px)] shadow-[var(--vlaina-shadow-control-active)] border border-[var(--vlaina-color-menu-border)]"
                                transition={{
                                    type: "spring",
                                    bounce: themeMotionTokens.settingsSegmentedControlBounce,
                                    duration: themeMotionTokens.settingsSegmentedControlDuration,
                                }}
                                style={{ zIndex: themeDomStyleTokens.zIndexBehind }}
                            />
                        )}
                        <div className="flex items-center justify-center w-[var(--vlaina-size-18px)] h-[var(--vlaina-size-18px)]">
                            {option.icon}
                        </div>
                        <span>{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

interface SettingsToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
}

export function SettingsToggle({ checked, onChange }: SettingsToggleProps) {
    const { t } = useI18n();

    return (
        <button
            onClick={() => onChange(!checked)}
            className={cn(
                "relative w-10 h-6 rounded-full transition-colors duration-[var(--vlaina-duration-200)] ease-in-out focus:outline-none",
                checked ? "bg-[var(--vlaina-accent)]" : "bg-[var(--vlaina-bg-tertiary)]"
            )}
        >
            <span className="sr-only">{t('common.toggleSetting')}</span>
            <span
                className={cn(
                    "inline-block w-[var(--vlaina-size-18px)] h-[var(--vlaina-size-18px)] bg-[var(--vlaina-color-white)] rounded-full shadow-[var(--vlaina-shadow-control-active)] transform transition-transform duration-[var(--vlaina-duration-200)] ease-in-out",
                    checked ? "translate-x-[var(--vlaina-translate-19px)]" : "translate-x-[var(--vlaina-translate-3px)]"
                )}
                style={{ marginTop: themeDomStyleTokens.marginTopSettingsToggle }}
            />
        </button>
    );
}

interface SettingsItemProps {
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
    'data-settings-item'?: string;
}

export function SettingsItem({
    title,
    description,
    children,
    className,
    'data-settings-item': dataSettingsItem,
}: SettingsItemProps) {
    return (
        <div
            data-settings-item={dataSettingsItem}
            className={cn("flex items-center justify-between px-6 py-4 mb-3 rounded-[var(--vlaina-radius-22px)]", chatComposerPillSurfaceClass, className)}
        >
            <div className="flex-1 pr-8">
                <div className="text-[var(--vlaina-font-sm)] font-semibold text-[var(--vlaina-sidebar-notes-text)] mb-0.5">
                    {title}
                </div>
                {description && (
                    <div className="text-[var(--vlaina-font-xs)] text-[var(--vlaina-sidebar-notes-text-soft)] leading-normal max-w-[var(--vlaina-size-420px)]">
                        {description}
                    </div>
                )}
            </div>
            <div className="flex-shrink-0">
                {children}
            </div>
        </div>
    );
}

export function SettingsSectionHeader({ children }: { children: ReactNode }) {
    return (
        <div className="mt-10 mb-4 px-2">
            <h3 className="text-[var(--vlaina-font-sm)] font-bold text-[var(--vlaina-sidebar-notes-text-soft)] tracking-tight opacity-[var(--vlaina-opacity-80)]">
                {children}
            </h3>
        </div>
    );
}
