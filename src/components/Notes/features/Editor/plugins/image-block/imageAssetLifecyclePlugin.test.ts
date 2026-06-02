import { describe, expect, it } from 'vitest';
import { collectImageAssetKeys, diffImageAssetKeys } from './imageAssetLifecycle';

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
});
