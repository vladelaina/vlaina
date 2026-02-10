import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
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
 icon={<Icon size="md" name="common.add" />}
                tooltip="New Doc"
                onClick={() => {
                    if (!expanded) setExpanded(true);
                    onCreateNote();
                }}
            />
            <IconButton
 icon={<Icon size="md" name="file.folder" />}
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