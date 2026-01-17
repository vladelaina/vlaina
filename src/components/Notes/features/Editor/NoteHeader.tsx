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
    const isNewlyCreated = useNotesStore(s => s.isNewlyCreated);

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
    // Now sourced from global preference via featureSlice logic
    const iconSize = useNotesStore(
        useCallback(state => {
            return state.noteMetadata?.defaultIconSize ?? 60;
        }, [])
    );

    // PERFORMANCE OPTIMIZATION:
    // Instead of using React State for "Preview Size" (which causes full re-renders),
    // We use a CSS Variable and Direct DOM manipulation.
    // This allows the slider to update the size at 60fps+ without layout thrashing.
    const headerRef = useRef<HTMLDivElement>(null);

    // Sync CSS variable when real state changes (initial load or DB update)
    useEffect(() => {
        if (headerRef.current) {
            headerRef.current.style.setProperty('--header-icon-size', `${iconSize}px`);
        }
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

    // Low-Overhead Handler: Updates CSS Variable Only
    const handleIconSizeChange = useCallback((size: number) => {
        if (headerRef.current) {
            // CRITICAL PERFORMANCE FIX:
            // Disable transitions during direct manipulation to prevent the browser from
            // trying to interpolate/animate the layout changes 60fps.
            // This eliminates the "fighting" between JS updates and CSS transitions.
            headerRef.current.style.transition = 'none';
            headerRef.current.style.setProperty('--header-icon-size', `${size}px`);
        }
    }, []);

    const handleIconSizeConfirm = useCallback((size: number) => {
        if (currentNotePath) {
            if (headerRef.current) {
                // Restore transition for future state changes (like Cover toggle)
                headerRef.current.style.transition = '';
            }
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
            ref={headerRef}
            className={cn(
                EDITOR_LAYOUT_CLASS,
                "z-10 relative transition-[margin-top] duration-75 ease-out",
                "pointer-events-none"
                // Removed will-change to let browser decide, and removed potential conflict
            )}
            style={{
                // Initialize variable for SSR/First Paint
                '--header-icon-size': `${iconSize}px`,
                // Use Calc with the Variable
                marginTop: coverUrl ? `calc(var(--header-icon-size) * -0.618)` : undefined
            } as React.CSSProperties}
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
                    "pb-4 duration-150 pointer-events-auto",
                    // Optimize Transition: Only animate properties we care about for Cover Toggle
                    // Avoid transition-all which catches the icon resize layout changes
                    "transition-[padding,opacity]",
                    coverUrl ? "pt-0" : "pt-20"
                )}
                onMouseEnter={() => setIsHoveringHeader(true)}
                onMouseLeave={() => setIsHoveringHeader(false)}
            >
                {displayIcon ? (
                    <div
                        className="relative flex items-center"
                        style={{ height: 'var(--header-icon-size)' }}
                    >
                        <button
                            ref={iconButtonRef}
                            onClick={() => setShowIconPicker(true)}
                            className="hover:scale-105 transition-transform cursor-pointer flex items-center"
                            style={{
                                marginLeft: `calc(var(--header-icon-size) * -0.1)`
                            }}
                        >
                            <NoteIcon icon={displayIcon} size="var(--header-icon-size)" />
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
                                currentSize={iconSize} // Pass the committed size (number) to helper initialization
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
                        autoFocus={!!isNewlyCreated}
                    />
                </div>
            )}
        </div>
    );
}
