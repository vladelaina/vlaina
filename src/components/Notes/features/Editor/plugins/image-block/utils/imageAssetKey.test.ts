import { describe, expect, it } from 'vitest';
import { getImageAssetKey } from './imageAssetKey';

describe('imageAssetKey', () => {
    it('normalizes local src with fragment', () => {
        expect(getImageAssetKey('./assets/demo.png#preview')).toBe('./assets/demo.png');
    });

    it('returns null for remote sources', () => {
        expect(getImageAssetKey('https://example.com/demo.png#preview')).toBeNull();
        expect(getImageAssetKey('blob:http://localhost/123')).toBeNull();
    });

    it('returns null for invalid input', () => {
        expect(getImageAssetKey('')).toBeNull();
        expect(getImageAssetKey(undefined)).toBeNull();
        expect(getImageAssetKey(null)).toBeNull();
    });

    it('keeps absolute local paths', () => {
        expect(getImageAssetKey('C:\\notes\\assets\\demo.png#preview')).toBe('C:\\notes\\assets\\demo.png');
        expect(getImageAssetKey('/home/user/notes/demo.png#preview')).toBe('/home/user/notes/demo.png');
    });
});
