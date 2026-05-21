import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { moveImageToTrash, restoreImageFromTrash } from './utils/fileUtils';
import { collectImageAssetKeys, diffImageAssetKeySets } from './imageAssetLifecycle';

const imageAssetLifecyclePluginKey = new PluginKey<ReadonlySet<string>>('imageAssetLifecyclePlugin');

function stepSliceContainsImage(step: unknown): boolean {
    const content = (step as {
        slice?: {
            content?: {
                descendants?: (callback: (node: { type?: { name?: string } }) => boolean | void) => void;
            };
        };
    }).slice?.content;
    if (!content || typeof content.descendants !== 'function') {
        return false;
    }

    let hasImage = false;
    content.descendants((node) => {
        if (node.type?.name === 'image') {
            hasImage = true;
            return false;
        }
        return true;
    });
    return hasImage;
}

function transactionMayInsertImage(tr: unknown): boolean {
    const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
    return steps.some(stepSliceContainsImage);
}

export const imageAssetLifecyclePlugin = $prose(() => {
    return new Plugin({
        key: imageAssetLifecyclePluginKey,
        state: {
            init(_config, state) {
                return collectImageAssetKeys(state.doc);
            },
            apply(tr, previous) {
                if (!tr.docChanged) {
                    return previous;
                }
                if (previous.size === 0 && !transactionMayInsertImage(tr)) {
                    return previous;
                }
                return collectImageAssetKeys(tr.doc);
            },
        },
        appendTransaction(transactions, oldState, newState) {
            const { notesPath, currentNote } = useNotesStore.getState();
            if (!notesPath) return null;

            const hasRelevantDocChange = transactions.some(
                (tr) => tr.docChanged && !tr.getMeta('imageDragMove'),
            );
            if (!hasRelevantDocChange) return null;

            const oldAssets = imageAssetLifecyclePluginKey.getState(oldState) ?? new Set<string>();
            const newAssets = imageAssetLifecyclePluginKey.getState(newState) ?? new Set<string>();
            if (oldAssets.size === 0 && newAssets.size === 0) {
                return null;
            }

            const { deletedAssets, insertedAssets } = diffImageAssetKeySets(oldAssets, newAssets);

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
