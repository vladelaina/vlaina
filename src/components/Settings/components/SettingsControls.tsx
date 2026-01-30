import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

// --- Segmented Control ---

// --- Segmented Control ---

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
                                ? "text-black dark:text-white"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
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
                        {/* Wrapper for Icon to ensure consistent size */}
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

// --- Settings Toggle ---

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

// --- Settings Item ---

interface SettingsItemProps {
    title: string;
    description?: string;
    children: ReactNode;
}

export function SettingsItem({ title, description, children }: SettingsItemProps) {
    return (
        <div className="flex items-start justify-between py-5 border-b border-zinc-100 dark:border-white/5 last:border-0">
            <div className="flex-1 pr-8">
                <div className="text-[14px] font-medium text-[#111] dark:text-zinc-100 mb-1 leading-snug">
                    {title}
                </div>
                {description && (
                    <div className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-[420px]">
                        {description}
                    </div>
                )}
            </div>
            <div className="flex-shrink-0 pt-0.5">
                {children}
            </div>
        </div>
    );
}

// --- Settings Section Header ---

export function SettingsSectionHeader({ children }: { children: ReactNode }) {
    return (
        <div className="mt-8 mb-2 pb-2">
            <h3 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                {children}
            </h3>
        </div>
    );
}
