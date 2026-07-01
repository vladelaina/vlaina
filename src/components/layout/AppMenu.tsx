import React from "react";
import { Icon } from "@/components/ui/icons";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
    getSidebarIdleRowSurfaceClass,
} from "@/components/layout/sidebar/sidebarLabelStyles";
import { DesktopUpdateBadge, useDesktopUpdateIndicatorVersion } from "@/components/desktop/DesktopUpdateIndicator";

interface AppMenuProps {
    onOpenSettings: () => void;
    onCloseMenu: () => void;
}

export const AppMenu: React.FC<AppMenuProps> = ({ onOpenSettings, onCloseMenu }) => {
    const { t } = useI18n();
    const updateIndicatorVersion = useDesktopUpdateIndicatorVersion();

    return (
        <div className="space-y-0.5 px-2 pb-2 pt-1">
            <button
                onClick={() => {
                    onOpenSettings();
                    onCloseMenu();
                }}
                className={cn(
                    "flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[var(--vlaina-font-base)] font-medium transition-[background-color,color,box-shadow] group/item whitespace-nowrap",
                    getSidebarIdleRowSurfaceClass('chat'),
                    "text-[var(--vlaina-sidebar-chat-text)] hover:!bg-[var(--vlaina-accent-light)] hover:text-[var(--vlaina-accent)] hover:shadow-[var(--vlaina-shadow-menu-hover)]"
                )}
            >
                <Icon size="md" name="common.settings" className="text-[var(--vlaina-sidebar-chat-text)] transition-colors group-hover/item:text-[var(--vlaina-accent)]" />
                <span className="min-w-0 flex-1 truncate">{t('account.settings')}</span>
                <DesktopUpdateBadge version={updateIndicatorVersion} className="ml-auto max-w-[6rem]" />
            </button>
        </div>
    );
};
