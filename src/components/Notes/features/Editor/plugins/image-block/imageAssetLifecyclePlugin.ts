import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { moveImageToTrash, restoreImageFromTrash } from './utils/fileUtils';
import { diffImageAssetKeys } from './imageAssetLifecycle';

const imageAssetLifecyclePluginKey = new PluginKey('imageAssetLifecyclePlugin');

export const imageAssetLifecyclePlugin = $prose(() => {
    return new Plugin({
        key: imageAssetLifecyclePluginKey,
        appendTransaction(transactions, oldState, newState) {
            const { notesPath, currentNote } = useNotesStore.getState();
            if (!notesPath) return null;

            const hasRelevantDocChange = transactions.some(
                (tr) => tr.docChanged && !tr.getMeta('imageDragMove'),
            );
            if (!hasRelevantDocChange) return null;

            const { deletedAssets, insertedAssets } = diffImageAssetKeys(oldState.doc, newState.doc);

            deletedAssets.forEach((src) => {
                void moveImageToTrash(src, notesPath, currentNote?.path);
            });

            insertedAssets.forEach((src) => {
                void restoreImageFromTrash(src, notesPath, currentNote?.path);
            });

            return null;
        },
    });
});
