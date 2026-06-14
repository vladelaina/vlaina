import { useCallback, useMemo } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { TitleInput } from './TitleInput';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { getParentPath } from '@/lib/storage/adapter';
import { HeroIconHeader } from '@/components/common/HeroIconHeader';
import { CoverAddOverlay } from '../Cover';
import { resolveCoverAssetUrl } from '../Cover/utils/resolveCoverAssetUrl';
import { NotePathBreadcrumb } from './components/NotePathBreadcrumb';
import { focusEditorAtTop } from './utils/focusEditor';
import { getNoteMetadataEntry } from '@/stores/notes/noteMetadataState';
import { getRandomHeaderEmoji } from '@/components/common/UniversalIconPicker/randomEmoji';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { resolveEffectiveVaultPath } from '@/stores/notes/effectiveVaultPath';
import type { CustomIcon } from '@/lib/storage/unifiedStorage';

interface NoteHeaderProps {
    coverUrl: string | null;
    coverLayoutActive?: boolean;
    onAddCover: () => void;
}

export function NoteHeader({ coverUrl, coverLayoutActive = Boolean(coverUrl), onAddCover }: NoteHeaderProps) {
    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const setNoteIcon = useNotesStore(s => s.setNoteIcon);
    const setNoteIconSize = useNotesStore(s => s.setNoteIconSize);
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
            return getNoteMetadataEntry(state.noteMetadata, currentNotePath)?.iconSize ?? state.noteIconSize;
        }, [currentNotePath])
    );

    const notesPath = useNotesStore(s => s.notesPath);
    const vaultPath = resolveEffectiveVaultPath({ notesPath, currentNotePath });
    const assetList = useNotesStore(s => s.assetList);
    const loadAssets = useNotesStore(s => s.loadAssets);
    const uploadAsset = useNotesStore(s => s.uploadAsset);

    const customIcons = useMemo<CustomIcon[]>(() => assetList.map((asset) => {
        const uploadedAt = Date.parse(asset.uploadedAt);
        return {
            id: asset.filename,
            url: asset.filename,
            name: asset.filename.split(/[\\/]/).pop() || asset.filename,
            createdAt: Number.isFinite(uploadedAt) ? uploadedAt : Date.now(),
        };
    }), [assetList]);

    const handleIconPickerOpen = useCallback(() => {
        if (!vaultPath) return undefined;
        return loadAssets(vaultPath);
    }, [loadAssets, vaultPath]);

    const uploadNoteIcon = useCallback(async (file: File) => {
        const result = await uploadAsset(file, currentNotePath);
        if (!result.success || !result.path) {
            return { success: false, error: result.error || 'Upload failed' };
        }
        return { success: true, url: result.path };
    }, [currentNotePath, uploadAsset]);

    const imageLoader = useCallback(async (src: string) => {
        return resolveCoverAssetUrl({
            assetPath: src,
            vaultPath,
            currentNotePath,
            replayAnimated: true,
        });
    }, [currentNotePath, vaultPath]);


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
            setNoteIconSize(currentNotePath, size);
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

    return (
        <HeroIconHeader
            id={currentNotePath || 'note-header'}
            className={EDITOR_LAYOUT_CLASS}
            
            icon={noteIcon || null}
            onIconChange={handleIconChange}
            
            iconSize={iconSize}
            onSizeConfirm={handleSizeConfirm}
            
            coverUrl={coverUrl}
            coverLayoutActive={coverLayoutActive}

            customIcons={customIcons}
            onUploadFile={uploadNoteIcon}
            onIconPickerOpen={handleIconPickerOpen}
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
            <CoverAddOverlay visible={!coverLayoutActive} onAddCover={onAddCover} />
        </HeroIconHeader>
    );
}
