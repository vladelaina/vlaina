import { useCallback } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { TitleInput } from './TitleInput';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { resolveVaultAssetPath } from '@/lib/assets/core/paths';
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
            return state.noteIconSize;
        }, [])
    );

    const vaultPath = useNotesStore(s => s.notesPath);

    const imageLoader = useCallback(async (src: string) => {
        if (!vaultPath) return src;
        const relativePath = src.substring(4);
        const fullPath = await resolveVaultAssetPath(vaultPath, relativePath, currentNotePath);
        return await loadImageAsBlob(fullPath);
    }, [currentNotePath, vaultPath]);

    const handleUploadFile = useCallback(async (file: File) => {
        const uploadAsset = useNotesStore.getState().uploadAsset;

        const result = await uploadAsset(file, currentNotePath);
        if (!result.success || !result.path) return { success: false, error: result.error };

        return { success: true, url: `img:${result.path}` };
    }, [currentNotePath]);


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
            
            onUploadFile={handleUploadFile}
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
