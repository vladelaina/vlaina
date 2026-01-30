import { useState } from 'react';
import { MdAdd, MdFolder } from 'react-icons/md';
import { useVaultStore } from '@/stores/useVaultStore';
import { IconButton } from '@/components/ui/icon-button';
import { FileTree } from './FileTree';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { type FolderNode } from '@/stores/useNotesStore';

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

    const vaultName = currentVault?.name || 'Workspace';

    const headerActions = (
        <>
            <IconButton
                icon={<MdAdd className="w-[18px] h-[18px]" />}
                tooltip="New Doc"
                onClick={() => {
                    if (!expanded) setExpanded(true);
                    onCreateNote();
                }}
            />
            <IconButton
                icon={<MdFolder className="w-[18px] h-[18px]" />}
                tooltip="New Folder"
                onClick={() => {
                    if (!expanded) setExpanded(true);
                    onCreateFolder();
                }}
            />
        </>
    );

    return (
        <CollapsibleSection
            title={vaultName}
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
            actions={headerActions}
        >
            <FileTree
                rootFolder={rootFolder}
                isLoading={isLoading}
                currentNotePath={currentNotePath}
            />
        </CollapsibleSection>
    );
}
