import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { HeartPulse } from 'lucide-react';
import { cn, iconButtonStyles } from '@/lib/utils';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { IconPicker, NoteIcon } from '../IconPicker';
import { TitleInput } from './TitleInput';
import { getRandomEmoji, loadRecentIcons, addToRecentIcons, loadSkinTone } from '../IconPicker/constants';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { getRandomBuiltinCover } from '@/lib/assets/builtinCovers';

interface NoteHeaderProps {
    coverUrl: string | null;
    onCoverUpdate: (url: string | null, x: number, y: number, h?: number, scale?: number) => void;
    setShowCoverPicker: (show: boolean) => void;
}

export function NoteHeader({ coverUrl, onCoverUpdate, setShowCoverPicker }: NoteHeaderProps) {
    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const setNoteIcon = useNotesStore(s => s.setNoteIcon);
    const setGlobalIconSize = useNotesStore(s => s.setGlobalIconSize);

    const setNotesPreviewIcon = useUIStore(s => s.setNotesPreviewIcon);

    const displayIcon = useDisplayIcon(currentNotePath);
    // Reactive subscription to note icon (for the "hasIcon" check)
    const noteIcon = useNotesStore(
        useCallback(state => {
            if (!currentNotePath) return undefined;
            return state.noteMetadata?.notes[currentNotePath]?.icon;
        }, [currentNotePath])
    );

    // Reactive subscription to icon size
    // This ensures the header re-renders if the size is changed from another tab/sync
    // Reactive subscription to icon size
    // Now sourced from global preference via featureSlice logic
    const iconSize = useNotesStore(
        useCallback(state => {
            // We use the selector logic directly here or just access the state
            // duplicating selector logic for performance is fine:
            return state.noteMetadata?.defaultIconSize ?? 60;
        }, [])
    );

    // Local state for smooth resizing
    // We sync with store on mount and when store updates (remote change)
    const [previewIconSize, setPreviewIconSize] = useState(iconSize);

    useEffect(() => {
        setPreviewIconSize(iconSize);
    }, [iconSize]);

    const [showIconPicker, setShowIconPicker] = useState(false);
    const [isHoveringHeader, setIsHoveringHeader] = useState(false);
    const iconButtonRef = useRef<HTMLButtonElement>(null);
    const previewRafRef = useRef<number | null>(null);
    const clearPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleIconSelect = (emoji: string) => {
        if (currentNotePath) {
            setNoteIcon(currentNotePath, emoji);
            setNotesPreviewIcon(null, null);
        }
    };

    const handleRemoveIcon = () => {
        if (currentNotePath) {
            setNoteIcon(currentNotePath, null);
            setNotesPreviewIcon(null, null);
        }
    };

    const handleIconSizeChange = useCallback((size: number) => {
        setPreviewIconSize(size);
    }, []);

    const handleIconSizeConfirm = useCallback((size: number) => {
        if (currentNotePath) {
            setGlobalIconSize(size);
        }
    }, [currentNotePath, setGlobalIconSize]);

    const handleIconPreview = useCallback((icon: string | null) => {
        if (!currentNotePath) return;

        if (clearPreviewTimerRef.current) {
            clearTimeout(clearPreviewTimerRef.current);
            clearPreviewTimerRef.current = null;
        }

        if (icon === null) {
            clearPreviewTimerRef.current = setTimeout(() => {
                setNotesPreviewIcon(null, null);
            }, 80);
        } else {
            if (previewRafRef.current !== null) {
                cancelAnimationFrame(previewRafRef.current);
            }
            previewRafRef.current = requestAnimationFrame(() => {
                previewRafRef.current = null;
                setNotesPreviewIcon(currentNotePath, icon);
            });
        }
    }, [currentNotePath, setNotesPreviewIcon]);

    const handleIconPickerClose = () => {
        setShowIconPicker(false);
        setIsHoveringHeader(false);
        if (previewRafRef.current !== null) {
            cancelAnimationFrame(previewRafRef.current);
            previewRafRef.current = null;
        }
        if (clearPreviewTimerRef.current) {
            clearTimeout(clearPreviewTimerRef.current);
            clearPreviewTimerRef.current = null;
        }
        setNotesPreviewIcon(null, null);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (previewRafRef.current !== null) {
                cancelAnimationFrame(previewRafRef.current);
            }
            if (clearPreviewTimerRef.current) {
                clearTimeout(clearPreviewTimerRef.current);
            }
        };
    }, []);

    // Calculate display name for Title Input
    const noteName = useMemo(() => {
        if (!currentNotePath) return '';
        const pathParts = currentNotePath.split(/[\\/]/);
        const fileName = pathParts[pathParts.length - 1] || 'Untitled';
        return fileName.replace(/\.md$/, '');
    }, [currentNotePath]);

    return (
        <div
            className={cn(
                EDITOR_LAYOUT_CLASS,
                "z-10 relative transition-[margin-top] duration-75 ease-out",
                "pointer-events-none",
                "will-change-[margin-top]"
            )}
            style={{
                marginTop: coverUrl ? `-${previewIconSize * 0.618}px` : undefined
            }}
        >
            {/* Clickable area to add cover - entire top padding area */}
            {!coverUrl && (
                <div
                    className="absolute top-0 left-0 right-0 h-20 cursor-pointer hover:bg-[var(--neko-hover)]/30 transition-colors pointer-events-auto"
                    onClick={() => {
                        // Get all available covers
                        const allCovers = useNotesStore.getState().getAssetList('covers');
                        let randomCover: string;

                        if (allCovers.length > 0) {
                            const randomIndex = Math.floor(Math.random() * allCovers.length);
                            randomCover = allCovers[randomIndex].filename;
                        } else {
                            // Fallback to builtin
                            randomCover = getRandomBuiltinCover();
                        }
                        onCoverUpdate(randomCover, 50, 50, 200, 1);
                        setShowCoverPicker(true);
                    }}
                />
            )}
            <div
                className={cn(
                    "pb-4 transition-all duration-150 pointer-events-auto",
                    coverUrl ? "pt-0" : "pt-20"
                )}
                onMouseEnter={() => setIsHoveringHeader(true)}
                onMouseLeave={() => setIsHoveringHeader(false)}
            >
                {displayIcon ? (
                    <div
                        className="relative flex items-center"
                        style={{ height: previewIconSize }}
                    >
                        <button
                            ref={iconButtonRef}
                            onClick={() => setShowIconPicker(true)}
                            className="hover:scale-105 transition-transform cursor-pointer flex items-center"
                            style={{
                                marginLeft: `-${previewIconSize * 0.1}px`
                            }}
                        >
                            <NoteIcon icon={displayIcon} size={previewIconSize} />
                        </button>
                    </div>
                ) : showIconPicker ? (
                    <div className="h-14 flex items-center">
                        <button
                            ref={iconButtonRef}
                            className={cn("flex items-center gap-1.5 py-1 rounded-md text-sm", iconButtonStyles)}
                        >
                            <HeartPulse className="size-4" />
                            <span>Add icon</span>
                        </button>
                    </div>
                ) : (
                    <div className={cn(
                        "flex items-center gap-2 transition-all duration-150",
                        isHoveringHeader ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}>
                        <button
                            ref={iconButtonRef}
                            onClick={() => {
                                if (!noteIcon) {
                                    const currentSkinTone = loadSkinTone();
                                    const randomEmoji = getRandomEmoji(currentSkinTone);
                                    handleIconSelect(randomEmoji);
                                    const currentRecent = loadRecentIcons();
                                    addToRecentIcons(randomEmoji, currentRecent);
                                }
                                setShowIconPicker(true);
                            }}
                            className={cn("flex items-center gap-1.5 py-1 rounded-md text-sm", iconButtonStyles)}
                        >
                            <HeartPulse className="size-4" />
                            <span>Add icon</span>
                        </button>
                    </div>
                )}

                {showIconPicker && (
                    <div className="relative">
                        <div className="absolute top-2 left-0 z-50">
                            <IconPicker
                                onSelect={handleIconSelect}
                                onPreview={handleIconPreview}
                                onRemove={handleRemoveIcon}
                                onClose={handleIconPickerClose}
                                hasIcon={!!noteIcon}
                                currentIcon={noteIcon}
                                currentSize={previewIconSize}
                                onSizeChange={handleIconSizeChange}
                                onSizeConfirm={handleIconSizeConfirm}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Title Input */}
            {currentNotePath && (
                <div className="mb-4 pointer-events-auto">
                    <TitleInput
                        notePath={currentNotePath}
                        initialTitle={noteName}
                        onEnter={() => {
                            const editor = document.querySelector('.milkdown .ProseMirror') as HTMLElement;
                            editor?.focus();
                        }}
                    />
                </div>
            )}
        </div>
    );
}
