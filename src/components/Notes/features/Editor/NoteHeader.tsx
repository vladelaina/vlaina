import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { TitleInput } from './TitleInput';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { resolveExistingVaultAssetPath } from '@/lib/assets/core/paths';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { getParentPath } from '@/lib/storage/adapter';
import { HeroIconHeader } from '@/components/common/HeroIconHeader';
import { CoverAddOverlay } from '../Cover';
import { NotePathBreadcrumb } from './components/NotePathBreadcrumb';
import { focusEditorAtTop } from './utils/focusEditor';
import { getNoteMetadataEntry } from '@/stores/notes/noteMetadataState';
import { getRandomHeaderEmoji } from '@/components/common/UniversalIconPicker/randomEmoji';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { logNotesDebug } from '@/stores/notes/debugLog';
import { resolveEffectiveVaultPath } from '@/stores/notes/effectiveVaultPath';

interface NoteHeaderProps {
    coverUrl: string | null;
    onAddCover: () => void;
}

export function NoteHeader({ coverUrl, onAddCover }: NoteHeaderProps) {
    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const lastHeaderDebugRef = useRef<string | null>(null);
    const setNoteIcon = useNotesStore(s => s.setNoteIcon);
    const setGlobalIconSize = useNotesStore(s => s.setGlobalIconSize);
    const isNewlyCreated = useNotesStore(s => s.isNewlyCreated);
    const noteMetadata = useNotesStore(s => s.noteMetadata);
    const draftTitle = useNotesStore(
        useCallback((state) => {
            if (!currentNotePath) return undefined;
            return state.draftNotes[currentNotePath]?.name;
        }, [currentNotePath])
    );

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

    const notesPath = useNotesStore(s => s.notesPath);
    const vaultPath = resolveEffectiveVaultPath({ notesPath, currentNotePath });

    const imageLoader = useCallback(async (src: string) => {
        if (!vaultPath) return src;
        const relativePath = src.substring(4);
        const fullPath = await resolveExistingVaultAssetPath(vaultPath, relativePath, currentNotePath);
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

    const scopedUsedIcons = useMemo(() => {
        const usedIcons = new Set<string>();
        if (!noteMetadata) {
            return usedIcons;
        }

        const parentPath = currentNotePath ? getParentPath(currentNotePath) : null;
        const folderPrefix = parentPath ? `${parentPath.replace(/\/+$/, '')}/` : '';

        for (const [path, entry] of Object.entries(noteMetadata.notes)) {
            if (path === currentNotePath) {
                continue;
            }

            if (folderPrefix && !path.startsWith(folderPrefix)) {
                continue;
            }

            if (entry.icon) {
                usedIcons.add(entry.icon);
            }
        }

        return usedIcons;
    }, [currentNotePath, noteMetadata]);

    const handleRequestRandomIcon = useCallback(() => {
        return getRandomHeaderEmoji(scopedUsedIcons);
    }, [scopedUsedIcons]);

    const isDraftNote = isDraftNotePath(currentNotePath);
    const titleInitialValue = isNewlyCreated
        ? ''
        : isDraftNote && draftTitle !== undefined ? draftTitle : noteName;
    const shouldAutoFocusTitle = Boolean(isNewlyCreated);

    useEffect(() => {
        const snapshot = JSON.stringify({
            currentNotePath: currentNotePath ?? null,
            isDraftNote,
            noteName,
            titleInitialValue,
            isNewlyCreated,
            shouldAutoFocusTitle,
            hasIcon: Boolean(noteIcon),
            hasCover: Boolean(coverUrl),
        });
        if (lastHeaderDebugRef.current === snapshot) return;
        lastHeaderDebugRef.current = snapshot;
        logNotesDebug('notes:header:state', JSON.parse(snapshot));
    }, [coverUrl, currentNotePath, isDraftNote, isNewlyCreated, noteIcon, noteName, shouldAutoFocusTitle, titleInitialValue]);

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
            onRequestRandomIcon={handleRequestRandomIcon}
            
            renderTitle={() => currentNotePath && (
                <div className="group/note-title">
                    <NotePathBreadcrumb notePath={currentNotePath} />
                    <TitleInput
                        notePath={currentNotePath}
                        initialTitle={titleInitialValue}
                        onEnter={focusEditorAtTop}
                        autoFocus={shouldAutoFocusTitle}
                    />
                </div>
            )}
        >
            <CoverAddOverlay visible={!coverUrl} onAddCover={onAddCover} />
        </HeroIconHeader>
    );
}
