import { describe, expect, it } from 'vitest';
import { getNormalStyle } from './styleUtils';

describe('image block style utils', () => {
    it('keeps newly inserted auto-sized images visible while they are loading', () => {
        expect(getNormalStyle({
            width: 'auto',
            height: undefined,
            isActive: false,
            isReady: false,
            computedAspectRatio: 'auto',
        })).toMatchObject({
            opacity: 1,
            minHeight: 'var(--vlaina-size-100px)',
        });
    });

    it('removes the loading min height after the image is ready', () => {
        expect(getNormalStyle({
            width: '320px',
            height: undefined,
            isActive: false,
            isReady: true,
            computedAspectRatio: '1.5',
        })).toMatchObject({
            opacity: 1,
            minHeight: undefined,
        });
    });

    it('uses locked pixel dimensions while the image cropper is active', () => {
        expect(getNormalStyle({
            width: '72%',
            height: undefined,
            isActive: true,
            isReady: true,
            computedAspectRatio: '2',
            activeSize: { width: 347.75, height: 166.14 },
        })).toMatchObject({
            width: '347.75px',
            height: '166.14px',
            aspectRatio: 'auto',
        });
    });
});
