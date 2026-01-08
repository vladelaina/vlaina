
import { useState } from 'react';
import { IconTriangleFilled, IconPlus, IconFolder } from '@tabler/icons-react';
import { useVaultStore } from '@/stores/useVaultStore';
import { IconButton } from '@/components/ui/icon-button';
import { FileTree } from '../FileTree'; // Adjusted path
import { type FolderNode } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';

interface WorkspaceSectionProps {
    rootFolder: FolderNode | null;
    isLoading: boolean;
    currentNotePath?: string;
    onCreateNote: () => void;
    onCreateFolder: () => void;
}

export function WorkspaceSection({
    rootFolder,
    isLoading,
    currentNotePath,
    onCreateNote,
    onCreateFolder
}: WorkspaceSectionProps) {
    const [expanded, setExpanded] = useState(true);
    const { currentVault } = useVaultStore();

    // Get vault name from path
    const vaultName = currentVault?.name || 'Workspace';

    const handleHeaderClick = (e: React.MouseEvent) => {
        // Only toggle expand state when clicking non-button area
        const target = e.target as HTMLElement;
        if (!target.closest('button')) {
            setExpanded(!expanded);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="px-2 py-1">
                <div
                    onClick={handleHeaderClick}
                    className="group flex items-center justify-between px-2 py-1 rounded-md hover:bg-[var(--neko-hover)] transition-colors cursor-pointer"
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-[var(--neko-text-tertiary)] tracking-wider">
                            {vaultName}
                        </span>
                        <IconTriangleFilled
                            className={cn(
                                "w-1.5 h-1.5 text-[#CDCDCD] transition-transform",
                                expanded ? "rotate-180" : "rotate-90"
                            )}
                        />
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconButton
                            icon={<IconPlus className="w-3.5 h-3.5" />}
                            tooltip="New Doc"
                            onClick={() => {
                                if (!expanded) setExpanded(true);
                                onCreateNote();
                            }}
                        />
                        <IconButton
                            icon={<IconFolder className="w-3.5 h-3.5" />}
                            tooltip="New Folder"
                            onClick={() => {
                                if (!expanded) setExpanded(true);
                                onCreateFolder();
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div
                className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
            >
                <div className="overflow-hidden">
                    <div className="px-1">
                        <FileTree
                            rootFolder={rootFolder}
                            isLoading={isLoading}
                            currentNotePath={currentNotePath}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
