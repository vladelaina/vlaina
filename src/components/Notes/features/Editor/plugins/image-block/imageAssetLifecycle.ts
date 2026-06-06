import { getImageAssetKey } from './utils/imageAssetKey';

export const MAX_IMAGE_ASSET_DOC_SCAN_NODES = 20_000;
export const MAX_IMAGE_ASSET_KEYS = 5_000;

export interface ImageAssetChangeSet {
    deletedAssets: Set<string>;
    insertedAssets: Set<string>;
}

export interface ImageAssetKeyScan {
    assetKeys: Set<string>;
    complete: boolean;
}

interface ImageAssetScanNode {
    type?: { name?: string };
    attrs?: { src?: unknown };
    childCount?: number;
    child?: (index: number) => ImageAssetScanNode | null | undefined;
    descendants?: (f: (node: ImageAssetScanNode) => boolean | void) => void;
}

export interface ImageNodeScan {
    found: boolean;
    complete: boolean;
}

function getScanChildCount(node: ImageAssetScanNode): number {
    return typeof node.childCount === 'number' && Number.isFinite(node.childCount) && node.childCount > 0
        ? Math.floor(node.childCount)
        : 0;
}

function scanImageAssetNodes(
    root: ImageAssetScanNode,
    visit: (node: ImageAssetScanNode) => boolean | void,
    maxNodes = MAX_IMAGE_ASSET_DOC_SCAN_NODES,
): boolean {
    if (typeof root.child === 'function') {
        let scanned = 0;
        const stack: Array<{ node: ImageAssetScanNode; index: number; childCount: number }> = [{
            node: root,
            index: 0,
            childCount: getScanChildCount(root),
        }];

        while (stack.length > 0) {
            const frame = stack[stack.length - 1];
            if (frame.index >= frame.childCount) {
                stack.pop();
                continue;
            }

            if (scanned >= maxNodes) {
                return false;
            }

            const node = frame.node.child?.(frame.index);
            frame.index += 1;
            if (!node) continue;

            scanned += 1;
            if (visit(node) === false) {
                return false;
            }

            const childCount = getScanChildCount(node);
            if (childCount > 0 && typeof node.child === 'function') {
                stack.push({ node, index: 0, childCount });
            }
        }

        return true;
    }

    let complete = true;
    let scanned = 0;
    root.descendants?.((node) => {
        scanned += 1;
        if (scanned > maxNodes) {
            complete = false;
            return false;
        }
        if (visit(node) === false) {
            complete = false;
            return false;
        }
        return true;
    });
    return complete;
}

export function scanImageNodePresence(
    root: ImageAssetScanNode,
    maxNodes = MAX_IMAGE_ASSET_DOC_SCAN_NODES,
): ImageNodeScan {
    let found = false;
    const complete = scanImageAssetNodes(root, (node) => {
        if (node.type?.name === 'image') {
            found = true;
            return false;
        }
        return true;
    }, maxNodes);

    return { found, complete: found ? true : complete };
}

export function scanImageAssetKeys(
    doc: ImageAssetScanNode,
    maxNodes = MAX_IMAGE_ASSET_DOC_SCAN_NODES,
): ImageAssetKeyScan {
    const assetKeys = new Set<string>();
    let capped = false;

    const complete = scanImageAssetNodes(doc, (node) => {
        if (node.type?.name !== 'image') return true;
        const assetKey = getImageAssetKey(node.attrs.src);
        if (assetKey) {
            if (assetKeys.size >= MAX_IMAGE_ASSET_KEYS) {
                capped = true;
                return false;
            }
            assetKeys.add(assetKey);
            if (assetKeys.size >= MAX_IMAGE_ASSET_KEYS) {
                capped = true;
                return false;
            }
        }
        return true;
    }, maxNodes);

    return {
        assetKeys,
        complete: complete && !capped,
    };
}

export function collectImageAssetKeys(doc: ImageAssetScanNode): Set<string> {
    const { assetKeys } = scanImageAssetKeys(doc);
    return assetKeys;
}

export function diffImageAssetKeys(
    oldDoc: ImageAssetScanNode,
    newDoc: ImageAssetScanNode,
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

export function diffImageAssetKeySets(
    oldAssets: ReadonlySet<string>,
    newAssets: ReadonlySet<string>,
): ImageAssetChangeSet {
    const deletedAssets = new Set<string>(oldAssets);
    newAssets.forEach((assetKey) => deletedAssets.delete(assetKey));

    const insertedAssets = new Set<string>(newAssets);
    oldAssets.forEach((assetKey) => insertedAssets.delete(assetKey));

    return {
        deletedAssets,
        insertedAssets,
    };
}
