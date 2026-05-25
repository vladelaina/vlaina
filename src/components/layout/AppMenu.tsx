import React from "react";
import { Icon } from "@/components/ui/icons";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useAccountSessionStore } from "@/stores/accountSession";
import { openExternalHref } from "@/lib/navigation/externalLinks";
import {
    getSidebarIdleRowSurfaceClass,
} from "@/components/layout/sidebar/sidebarLabelStyles";

const membershipPlanUrl = 'https://vlaina.com/r/account_plan';

interface AppMenuProps {
    onOpenSettings: () => void;
    onCloseMenu: () => void;
}

export const AppMenu: React.FC<AppMenuProps> = ({ onOpenSettings, onCloseMenu }) => {
    const { t } = useI18n();
    const { isConnected, membershipTier } = useAccountSessionStore();
    const shouldShowUpgrade = isConnected && membershipTier === 'free';

    return (
        <div className="px-1.5 pb-1.5 pt-0.5 space-y-0.5">
            {shouldShowUpgrade ? (
                <button
                    onClick={() => {
                        onCloseMenu();
                        void openExternalHref(membershipPlanUrl);
                    }}
                    className={cn(
                        "flex w-full cursor-pointer items-center gap-2 px-2.5 py-2 text-left text-[16px] font-medium transition-colors group/item",
                        getSidebarIdleRowSurfaceClass('chat'),
                        "text-[var(--chat-sidebar-text)] hover:bg-[var(--vlaina-accent-light)] hover:text-[var(--vlaina-accent)]"
                    )}
                >
                    <Icon size="md" name="common.shootingStar" className="text-[var(--chat-sidebar-text)] transition-colors group-hover/item:text-[var(--vlaina-accent)]" />
                    <span>{t('account.upgrade')}</span>
                </button>
            ) : null}
            <button
                onClick={() => {
                    onOpenSettings();
                    onCloseMenu();
                }}
                className={cn(
                    "flex w-full cursor-pointer items-center gap-2 px-2.5 py-2 text-left text-[16px] font-medium transition-colors group/item",
                    getSidebarIdleRowSurfaceClass('chat'),
                    "text-[var(--chat-sidebar-text)] hover:bg-[var(--chat-sidebar-row-hover)]"
                )}
            >
                <Icon size="md" name="common.settings" className="text-[var(--chat-sidebar-text)]" />
                <span>{t('account.settings')}</span>
            </button>
        </div>
    );
};
