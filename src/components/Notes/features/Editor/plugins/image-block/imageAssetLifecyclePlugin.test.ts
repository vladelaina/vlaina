import { describe, expect, it } from 'vitest';
import {
    collectImageAssetKeys,
    diffImageAssetKeys,
    MAX_IMAGE_ASSET_KEYS,
    scanImageAssetKeys,
    scanImageNodePresence,
} from './imageAssetLifecycle';

function createDoc(srcList: unknown[]) {
    return {
        descendants(f: (node: { type: { name: string }; attrs: { src?: unknown } }) => void) {
            srcList.forEach((src) => {
                f({
                    type: { name: 'image' },
                    attrs: { src },
                });
            });
        },
    };
}

describe('imageAssetLifecyclePlugin', () => {
    it('collects only local image asset keys', () => {
        const assetKeys = collectImageAssetKeys(createDoc([
            './assets/demo.png#one',
            './assets/queried.png?cache=1#preview',
            'https://example.com/demo.png',
            'blob:http://localhost/demo',
            './assets/demo.png#two',
        ]));

        expect(Array.from(assetKeys)).toEqual(['./assets/demo.png', './assets/queried.png']);
    });

    it('diffs deleted and inserted local image assets', () => {
        const { deletedAssets, insertedAssets } = diffImageAssetKeys(
            createDoc(['./assets/one.png', './assets/two.png']),
            createDoc(['./assets/two.png', './assets/three.png']),
        );

        expect(Array.from(deletedAssets)).toEqual(['./assets/one.png']);
        expect(Array.from(insertedAssets)).toEqual(['./assets/three.png']);
    });

    it('does not diff the same local image when only query params change', () => {
        const { deletedAssets, insertedAssets } = diffImageAssetKeys(
            createDoc(['./assets/demo.png?cache=1']),
            createDoc(['./assets/demo.png?cache=2']),
        );

        expect(Array.from(deletedAssets)).toEqual([]);
        expect(Array.from(insertedAssets)).toEqual([]);
    });

    it('marks asset scans incomplete when the node budget is exhausted', () => {
        const scan = scanImageAssetKeys(createDoc([
            './assets/one.png',
            './assets/two.png',
            './assets/three.png',
        ]), 2);

        expect(scan.complete).toBe(false);
        expect(Array.from(scan.assetKeys)).toEqual(['./assets/one.png', './assets/two.png']);
    });

    it('marks asset scans incomplete when the asset key budget is exhausted', () => {
        const srcList = Array.from({ length: MAX_IMAGE_ASSET_KEYS + 1 }, (_, index) => `./assets/${index}.png`);
        const scan = scanImageAssetKeys(createDoc(srcList));

        expect(scan.complete).toBe(false);
        expect(scan.assetKeys.size).toBe(MAX_IMAGE_ASSET_KEYS);
    });

    it('treats exhausted image presence scans as incomplete instead of absent', () => {
        expect(scanImageNodePresence(createDoc(['./assets/one.png']), 10)).toEqual({
            found: true,
            complete: true,
        });
        expect(scanImageNodePresence(createDoc(['./assets/one.png']), 0)).toEqual({
            found: false,
            complete: false,
        });
    });
});
