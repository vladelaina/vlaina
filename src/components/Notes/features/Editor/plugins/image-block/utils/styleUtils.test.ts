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
            minHeight: 100,
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
});
