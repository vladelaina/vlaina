import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

interface SegmentedControlProps {
    options: { value: string; label: string; icon?: ReactNode }[];
    value: string;
    onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
    return (
        <div className="flex p-0.5 bg-[#F4F4F5] dark:bg-[#2A2A2A] rounded-lg border border-transparent dark:border-white/10">
            {options.map((option) => {
                const isActive = value === option.value;
                return (
                    <button
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "relative flex items-center justify-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-[6px] transition-all z-10 flex-1",
                            isActive
                                ? "text-[var(--sidebar-row-selected-text)]"
                                : "text-[var(--chat-sidebar-text)] hover:text-[var(--chat-sidebar-text)]"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="segmented-bg"
                                className="absolute inset-0 bg-white dark:bg-[#3E3E3E] rounded-[6px] shadow-[0_1px_2px_rgba(0,0,0,0.08)] border border-black/5 dark:border-white/10"
                                transition={{ type: "spring", bounce: 0.15, duration: 0.25 }}
                                style={{ zIndex: -1 }}
                            />
                        )}
                        <div className="flex items-center justify-center w-[18px] h-[18px]">
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
    return (
        <button
            onClick={() => onChange(!checked)}
            className={cn(
                "relative w-10 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none",
                checked ? "bg-[#1E96EB]" : "bg-zinc-200 dark:bg-zinc-600"
            )}
        >
            <span className="sr-only">Toggle setting</span>
            <span
                className={cn(
                    "inline-block w-[18px] h-[18px] bg-white rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.1)] transform transition-transform duration-200 ease-in-out",
                    checked ? "translate-x-[19px]" : "translate-x-[3px]"
                )}
                style={{ marginTop: '3px' }}
            />
        </button>
    );
}

interface SettingsItemProps {
    title: string;
    description?: string;
    children: ReactNode;
}

export function SettingsItem({ title, description, children }: SettingsItemProps) {
    return (
        <div className={cn("flex items-center justify-between px-6 py-4 mb-3 rounded-[22px]", chatComposerPillSurfaceClass)}>
            <div className="flex-1 pr-8">
                <div className="text-[14px] font-semibold text-[var(--notes-sidebar-text)] mb-0.5">
                    {title}
                </div>
                {description && (
                    <div className="text-[12px] text-[var(--notes-sidebar-text-soft)] leading-normal max-w-[420px]">
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
            <h3 className="text-[14px] font-bold text-[var(--notes-sidebar-text-soft)] tracking-tight opacity-80">
                {children}
            </h3>
        </div>
    );
}
