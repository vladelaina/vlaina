import { getImageAssetKey } from './utils/imageAssetKey';

export interface ImageAssetChangeSet {
    deletedAssets: Set<string>;
    insertedAssets: Set<string>;
}

export function collectImageAssetKeys(doc: {
    descendants: (f: (node: { type: { name: string }; attrs: { src?: unknown } }) => void) => void;
}): Set<string> {
    const assetKeys = new Set<string>();

    doc.descendants((node) => {
        if (node.type.name !== 'image') return;
        const assetKey = getImageAssetKey(node.attrs.src);
        if (assetKey) {
            assetKeys.add(assetKey);
        }
    });

    return assetKeys;
}

export function diffImageAssetKeys(
    oldDoc: {
        descendants: (f: (node: { type: { name: string }; attrs: { src?: unknown } }) => void) => void;
    },
    newDoc: {
        descendants: (f: (node: { type: { name: string }; attrs: { src?: unknown } }) => void) => void;
    },
): ImageAssetChangeSet {
    const oldAssets = collectImageAssetKeys(oldDoc);
    const newAssets = collectImageAssetKeys(newDoc);

    const deletedAssets = new Set<string>(oldAssets);
    newAssets.forEach((assetKey) => deletedAssets.delete(assetKey));

    const insertedAssets = new Set<string>(newAssets);
    oldAssets.forEach((assetKey) => insertedAssets.delete(assetKey));

    return {
        deletedAssets,
        insertedAssets,
    };
}
