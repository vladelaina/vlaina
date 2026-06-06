import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { moveImageToTrash, restoreImageFromTrash } from './utils/fileUtils';
import {
    diffImageAssetKeySets,
    scanImageAssetKeys,
    scanImageNodePresence,
    type ImageAssetScanNode,
} from './imageAssetLifecycle';

interface ImageAssetLifecycleState {
    assetKeys: ReadonlySet<string>;
    complete: boolean;
}

const EMPTY_IMAGE_ASSET_LIFECYCLE_STATE: ImageAssetLifecycleState = {
    assetKeys: new Set<string>(),
    complete: true,
};

const imageAssetLifecyclePluginKey = new PluginKey<ImageAssetLifecycleState>('imageAssetLifecyclePlugin');

function stepSliceContainsImage(step: unknown): boolean {
    const content = (step as {
        slice?: {
            content?: ImageAssetScanNode;
        };
    }).slice?.content;
    if (!content || (typeof content.child !== 'function' && typeof content.descendants !== 'function')) {
        return false;
    }

    const result = scanImageNodePresence(content);
    return result.found || !result.complete;
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
                const scan = scanImageAssetKeys(state.doc);
                return { assetKeys: scan.assetKeys, complete: scan.complete };
            },
            apply(tr, previous) {
                if (!tr.docChanged) {
                    return previous;
                }
                if (previous.complete && previous.assetKeys.size === 0 && !transactionMayInsertImage(tr)) {
                    return previous;
                }
                const scan = scanImageAssetKeys(tr.doc);
                return { assetKeys: scan.assetKeys, complete: scan.complete };
            },
        },
        appendTransaction(transactions, oldState, newState) {
            const { notesPath, currentNote } = useNotesStore.getState();
            if (!notesPath) return null;

            const hasRelevantDocChange = transactions.some(
                (tr) => tr.docChanged && !tr.getMeta('imageDragMove'),
            );
            if (!hasRelevantDocChange) return null;

            const oldAssetState = imageAssetLifecyclePluginKey.getState(oldState) ?? EMPTY_IMAGE_ASSET_LIFECYCLE_STATE;
            const newAssetState = imageAssetLifecyclePluginKey.getState(newState) ?? EMPTY_IMAGE_ASSET_LIFECYCLE_STATE;
            if (!oldAssetState.complete || !newAssetState.complete) {
                return null;
            }

            const oldAssets = oldAssetState.assetKeys;
            const newAssets = newAssetState.assetKeys;
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
