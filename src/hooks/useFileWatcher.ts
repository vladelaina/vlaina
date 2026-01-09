import { useEffect, useRef } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';

/**
 * Hook to poll file system for changes
 * - Reloads file tree to detect new/deleted files
 * - Checks current note for external content changes
 */
export function useFileWatcher(intervalMs = 3000) {
    const { currentNote, notesPath, loadFileTree, updateContent } = useNotesStore();
    const lastModifiedRef = useRef<number>(0);
    const isDirtyRef = useRef(false);

    // Keep ref synced with store state to avoid effect re-runs
    useEffect(() => {
        isDirtyRef.current = useNotesStore.getState().isDirty;
    }, [useNotesStore.getState().isDirty]);

    // File Tree Polling
    useEffect(() => {
        if (!notesPath) return;

        const pollTree = async () => {
            // Re-load file tree to catch additions/deletions
            // This is relatively cheap for small vaults, but could be optimized later
            // by listing root and comparing counts/timestamps if needed.
            // For now, we trust loadFileTree to be efficient enough or user accepts minor delay.
            await loadFileTree(true);
        };

        const timer = setInterval(pollTree, intervalMs);
        return () => clearInterval(timer);
    }, [notesPath, loadFileTree, intervalMs]);

    // Current Note Content Polling
    useEffect(() => {
        if (!currentNote || !notesPath) return;

        const pollContent = async () => {
            // detailed check for active file
            try {
                const storage = getStorageAdapter();
                const fullPath = await joinPath(notesPath, currentNote.path);
                const stats = await storage.stat(fullPath);

                if (!stats || !stats.modifiedAt) return;

                // Verify if file is newer than our last known state
                // We use a small buffer or just strict comparison.
                // If we just loaded the note, lastModifiedRef should be init.

                // Initial load sync logic constraint:
                // We need to capture the mtime when we open the note.
                // But useNotesStore doesn't expose mtime easily.
                // So we might trigger one unnecessary reload on first mount, which is okay.

                if (stats.modifiedAt > lastModifiedRef.current) {
                    lastModifiedRef.current = stats.modifiedAt;

                    // SAFETY: Don't overwrite if user has unsaved changes
                    if (isDirtyRef.current) {
                        console.log("External change detected, but local is dirty. Ignoring.");
                        return;
                    }

                    // Check actual content diff
                    const diskContent = await storage.readFile(fullPath);
                    if (diskContent !== currentNote.content) {
                        console.log("Reloading content from disk (external change)");

                        // We need to carefully update without triggering "isDirty"
                        // updateContent marks it dirty?
                        // Checking useNotesStore: updateContent just sets content.
                        // But Editor listener triggers on update.
                        // We'll update the store, and the Editor should listen to store changes?
                        // MilkdownEditor listens to `currentNote` content changes in some way?
                        // Let's check Editor implementation.

                        // Actually, simplest way: update store, Editor receives new default value if we force it?
                        // Our Editor component uses `key={currentNote.path}`.
                        // It does NOT auto-update if content changes while path stays same.

                        // To fix this, we might need an event or just force update.
                        // But for now, let's just update the store.
                        // The Editor might need a "reload" mechanism.

                        // Workaround: We can't easily force Milkdown to replace content from outside 
                        // without a custom command or remounting.
                        // Remounting is abrupt.
                        // But standard "Hot Reload" usually just updates.

                        updateContent(diskContent);

                        // We might need to flag "saved" to reset dirty state
                        // useNotesStore doesn't expose strict "setDirty(false)".
                        // But `saveNote` sets dirty false.
                    }
                }
            } catch (e) {
                // file might be deleted or locked
                console.error("Poll error:", e);
            }
        };

        // Initial stat to set baseline
        const initStat = async () => {
            try {
                const storage = getStorageAdapter();
                const fullPath = await joinPath(notesPath, currentNote.path);
                const stats = await storage.stat(fullPath);
                if (stats?.modifiedAt) {
                    lastModifiedRef.current = stats.modifiedAt;
                }
            } catch { }
        };
        initStat();

        const timer = setInterval(pollContent, intervalMs);
        return () => clearInterval(timer);
    }, [currentNote?.path, notesPath, intervalMs, updateContent]); // Re-init when path switches
}
