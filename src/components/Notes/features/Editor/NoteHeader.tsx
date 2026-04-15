import { useCallback, useEffect } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { TitleInput } from './TitleInput';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { resolveSystemAssetPath } from '@/lib/assets/core/paths';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { HeroIconHeader } from '@/components/common/HeroIconHeader';
import { CoverAddOverlay } from '../Cover';
import { NotePathBreadcrumb } from './components/NotePathBreadcrumb';
import { focusEditorAtTop } from './utils/focusEditor';
import { getNoteMetadataEntry } from '@/stores/notes/noteMetadataState';

interface NoteHeaderProps {
    coverUrl: string | null;
    onAddCover: () => void;
}

export function NoteHeader({ coverUrl, onAddCover }: NoteHeaderProps) {
    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const setNoteIcon = useNotesStore(s => s.setNoteIcon);
    const setGlobalIconSize = useNotesStore(s => s.setGlobalIconSize);
    const isNewlyCreated = useNotesStore(s => s.isNewlyCreated);

    const noteIcon = useNotesStore(
        useCallback(state => {
            return getNoteMetadataEntry(state.noteMetadata, currentNotePath)?.icon;
        }, [currentNotePath])
    );

    const iconSize = useNotesStore(
        useCallback(state => {
            return state.noteMetadata?.defaultIconSize ?? 60;
        }, [])
    );

    const workspaceEmojis = useNotesStore(s => s.workspaceEmojis);
    const removeWorkspaceEmoji = useNotesStore(s => s.removeWorkspaceEmoji);
    const loadWorkspaceEmojis = useNotesStore(s => s.loadWorkspaceEmojis);
    const vaultPath = useNotesStore(s => s.notesPath);

    useEffect(() => {
        loadWorkspaceEmojis();
    }, [loadWorkspaceEmojis]);

    const imageLoader = useCallback(async (src: string) => {
        if (!vaultPath) return src;
        const relativePath = src.substring(4);
        const fullPath = await resolveSystemAssetPath(vaultPath, relativePath, 'icons');
        return await loadImageAsBlob(fullPath);
    }, [vaultPath]);

    const handleUploadFile = useCallback(async (file: File) => {
        const uploadAsset = useNotesStore.getState().uploadAsset;
        const addWorkspaceEmoji = useNotesStore.getState().addWorkspaceEmoji;

        const result = await uploadAsset(file, 'icons');
        if (!result.success || !result.path) return { success: false, error: result.error };

        const assetUrl = `img:${result.path}`;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
        const finalName = `icon_${timestamp[0]}_${timestamp[1].split('Z')[0]}`;

        await addWorkspaceEmoji({
            id: file.name,
            name: finalName,
            url: assetUrl,
            createdAt: Date.now(),
        });
        return { success: true, url: assetUrl };
    }, []);


    const noteName = useNotesStore(
        useCallback((state) => {
            if (!currentNotePath) return '';
            return state.getDisplayName(currentNotePath);
        }, [currentNotePath])
    );

    const handleIconChange = (newIcon: string | null) => {
        if (currentNotePath) {
            setNoteIcon(currentNotePath, newIcon);
        }
    };

    const handleSizeConfirm = (size: number) => {
        if (currentNotePath) {
            setGlobalIconSize(size);
        }
    };

    return (
        <HeroIconHeader
            id={currentNotePath || 'note-header'}
            className={EDITOR_LAYOUT_CLASS}
            
            icon={noteIcon || null}
            onIconChange={handleIconChange}
            
            iconSize={iconSize}
            onSizeConfirm={handleSizeConfirm}
            
            coverUrl={coverUrl}
            
            customIcons={workspaceEmojis}
            onUploadFile={handleUploadFile}
            onDeleteCustomIcon={removeWorkspaceEmoji}
            imageLoader={imageLoader}
            
            renderTitle={() => currentNotePath && (
                <div className="group/note-title">
                    <NotePathBreadcrumb notePath={currentNotePath} />
                    <TitleInput
                        notePath={currentNotePath}
                        initialTitle={noteName}
                        onEnter={focusEditorAtTop}
                        autoFocus={!!isNewlyCreated}
                    />
                </div>
            )}
        >
            <CoverAddOverlay visible={!coverUrl} onAddCover={onAddCover} />
        </HeroIconHeader>
    );
}
