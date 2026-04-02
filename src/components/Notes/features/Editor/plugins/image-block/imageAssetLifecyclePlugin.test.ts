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
            './assets/demo.png#a=left',
            'https://example.com/demo.png',
            'blob:http://localhost/demo',
            './assets/demo.png#a=right',
        ]));

        expect(Array.from(assetKeys)).toEqual(['./assets/demo.png']);
    });

    it('diffs deleted and inserted local image assets', () => {
        const { deletedAssets, insertedAssets } = diffImageAssetKeys(
            createDoc(['./assets/one.png', './assets/two.png']),
            createDoc(['./assets/two.png', './assets/three.png']),
        );

        expect(Array.from(deletedAssets)).toEqual(['./assets/one.png']);
        expect(Array.from(insertedAssets)).toEqual(['./assets/three.png']);
    });
});
