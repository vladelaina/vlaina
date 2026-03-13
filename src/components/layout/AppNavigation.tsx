import React from "react";
import { Icon } from "@/components/ui/icons";
import { useUIStore, AppViewMode } from "@/stores/uiSlice";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface AppNavigationProps {
    onCloseMenu: () => void;
    tooltipsEnabled: boolean;
}

export const AppNavigation: React.FC<AppNavigationProps> = ({ onCloseMenu, tooltipsEnabled }) => {
    const { appViewMode, setAppViewMode } = useUIStore();

    const handleViewSwitch = (mode: AppViewMode) => {
        if (appViewMode === mode) return;
        onCloseMenu();
        // Defer state update just enough to let the menu unmount first
        setTimeout(() => {
            setAppViewMode(mode);
        }, 10);
    };

    const navItems = [
        { mode: 'notes', icon: 'file.text', label: 'Notes' },
        { mode: 'chat', icon: 'common.sparkle', label: 'AI Chat' },
        { mode: 'lab', icon: 'misc.lab', label: 'Lab' },
    ] as const;

    return (
        <div className="flex items-center justify-center gap-2 px-3 py-2">
            {navItems.map((item) => (
                <div key={item.mode}>
                    {tooltipsEnabled ? (
                        <Tooltip delayDuration={500}>
                            <TooltipTrigger asChild>
                                <NavButton 
                                    isActive={appViewMode === item.mode}
                                    onClick={() => handleViewSwitch(item.mode)}
                                    icon={item.icon}
                                />
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={4}>
                                <span className="text-xs font-medium">{item.label}</span>
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <NavButton 
                            isActive={appViewMode === item.mode}
                            onClick={() => handleViewSwitch(item.mode)}
                            icon={item.icon}
                        />
                    )}
                </div>
            ))}
        </div>
    );
};

// Sub-component for individual buttons
const NavButton = ({ isActive, onClick, icon }: { isActive: boolean; onClick: () => void; icon: string }) => (
    <button
        onClick={onClick}
        className={cn(
            "flex items-center justify-center w-12 h-12 rounded-lg transition-all",
            isActive
                ? "bg-[var(--neko-accent-light)] text-[var(--neko-accent)] shadow-sm"
                : "bg-[var(--neko-bg-secondary)] hover:bg-[var(--neko-hover)] text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-primary)]"
        )}
    >
        <Icon name={icon} className="w-6 h-6" />
    </button>
);
