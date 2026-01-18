import { useRef, useCallback, useEffect, useMemo } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { TitleInput } from './TitleInput';
import { loadSkinTone } from '@/components/common/UniversalIconPicker/constants';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { getRandomBuiltinCover } from '@/lib/assets/builtinCovers';
import { buildFullAssetPath } from '@/lib/assets/pathUtils';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';
import { HeroIconHeader } from '@/components/common/HeroIconHeader';

interface NoteHeaderProps {
    coverUrl: string | null;
    onCoverUpdate: (url: string | null, x: number, y: number, h?: number, scale?: number) => void;
    setShowCoverPicker: (show: boolean) => void;
}

export function NoteHeader({ coverUrl, onCoverUpdate, setShowCoverPicker }: NoteHeaderProps) {
    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const setNoteIcon = useNotesStore(s => s.setNoteIcon);
    const setGlobalIconSize = useNotesStore(s => s.setGlobalIconSize);
    const isNewlyCreated = useNotesStore(s => s.isNewlyCreated);

    // Reactive subscription to note icon
    const noteIcon = useNotesStore(
        useCallback(state => {
            if (!currentNotePath) return undefined;
            return state.noteMetadata?.notes[currentNotePath]?.icon;
        }, [currentNotePath])
    );

    // Reactive subscription to icon size
    const iconSize = useNotesStore(
        useCallback(state => {
            return state.noteMetadata?.defaultIconSize ?? 60;
        }, [])
    );

    // Custom Upload Handlers for Universal Picker
    const workspaceEmojis = useNotesStore(s => s.workspaceEmojis);
    const removeWorkspaceEmoji = useNotesStore(s => s.removeWorkspaceEmoji);
    const loadWorkspaceEmojis = useNotesStore(s => s.loadWorkspaceEmojis);
    const vaultPath = useNotesStore(s => s.notesPath);

    // Auto-load workspace icons on mount
    useEffect(() => {
        loadWorkspaceEmojis();
    }, [loadWorkspaceEmojis]);

    const imageLoader = useCallback(async (src: string) => {
        if (!vaultPath) return src;
        const relativePath = src.substring(4);
        const fullPath = buildFullAssetPath(vaultPath, relativePath);
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


    // Calculate display name for Title Input
    const noteName = useMemo(() => {
        if (!currentNotePath) return '';
        const pathParts = currentNotePath.split(/[\\/]/);
        const fileName = pathParts[pathParts.length - 1] || 'Untitled';
        return fileName.replace(/\.md$/, '');
    }, [currentNotePath]);

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
                <TitleInput
                    notePath={currentNotePath}
                    initialTitle={noteName}
                    onEnter={() => {
                        const editor = document.querySelector('.milkdown .ProseMirror') as HTMLElement;
                        editor?.focus();
                    }}
                    autoFocus={!!isNewlyCreated}
                />
            )}
        >
            {!coverUrl && (
                <div
                    className="absolute top-0 left-0 right-0 h-20 cursor-pointer hover:bg-[var(--neko-hover)]/30 transition-colors pointer-events-auto"
                    onClick={() => {
                        const allCovers = useNotesStore.getState().getAssetList('covers');
                        let randomCover: string;

                        if (allCovers.length > 0) {
                            const randomIndex = Math.floor(Math.random() * allCovers.length);
                            randomCover = allCovers[randomIndex].filename;
                        } else {
                            randomCover = getRandomBuiltinCover();
                        }
                        onCoverUpdate(randomCover, 50, 50, 200, 1);
                        setShowCoverPicker(true);
                    }}
                />
            )}
        </HeroIconHeader>
    );
}
