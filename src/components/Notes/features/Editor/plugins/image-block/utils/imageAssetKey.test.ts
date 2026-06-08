import { describe, expect, it } from 'vitest';
import { getImageAssetKey } from './imageAssetKey';

describe('imageAssetKey', () => {
    it('normalizes local src with fragment', () => {
        expect(getImageAssetKey('./assets/demo.png#preview')).toBe('./assets/demo.png');
    });

    it('normalizes local src with query and fragment', () => {
        expect(getImageAssetKey('./assets/demo.png?cache=1#preview')).toBe('./assets/demo.png');
    });

    it('normalizes internal img asset refs to their local asset path', () => {
        expect(getImageAssetKey('img:assets/demo.png?cache=1#preview')).toBe('assets/demo.png');
        expect(getImageAssetKey('IMG:assets/demo.png#preview')).toBe('assets/demo.png');
        expect(getImageAssetKey('img:/home/user/notes/demo.png#preview')).toBeNull();
    });

    it('returns null for internal notes asset paths while allowing user dot folders', () => {
        expect(getImageAssetKey('.vlaina/assets/demo.png')).toBeNull();
        expect(getImageAssetKey('docs/.git/demo.png')).toBeNull();
        expect(getImageAssetKey('docs/.GIT/demo.png')).toBeNull();
        expect(getImageAssetKey('img:%2evlaina/assets/demo.png')).toBeNull();
        expect(getImageAssetKey('img:docs%2f.git%2fdemo.png')).toBeNull();
        expect(getImageAssetKey('.notes/assets/demo.png')).toBe('.notes/assets/demo.png');
        expect(getImageAssetKey('img:%2enotes/assets/demo.png')).toBe('%2enotes/assets/demo.png');
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

    it('returns null for unsafe local paths', () => {
        expect(getImageAssetKey('C:\\notes\\assets\\demo.png#preview')).toBeNull();
        expect(getImageAssetKey('/home/user/notes/demo.png#preview')).toBeNull();
        expect(getImageAssetKey('assets/evil\u202E.png')).toBeNull();
    });
});
