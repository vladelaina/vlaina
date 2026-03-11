import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useVaultStore } from '@/stores/useVaultStore';
import { IconButton } from '@/components/ui/icon-button';
import { FileTree } from './FileTree';
import { type FolderNode } from '@/stores/useNotesStore';
import { NotesSidebarSection } from '../Sidebar/NotesSidebarPrimitives';

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
    const vaultName = currentVault?.name || 'Local Workspace';

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
        <NotesSidebarSection
            title={vaultName}
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
            actions={currentVault ? headerActions : undefined}
        >
            {currentVault ? (
                <FileTree
                    rootFolder={rootFolder}
                    isLoading={isLoading}
                    currentNotePath={currentNotePath}
                />
            ) : (
                <div className="px-3 py-3 text-[12px] text-[var(--notes-sidebar-text-soft)]">
                    Open a local vault to browse local notes.
                </div>
            )}
        </NotesSidebarSection>
    );
}
