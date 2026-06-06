import { describe, expect, it } from 'vitest';
import { hasClipboardPayload } from './clipboardPlugin';

describe('hasClipboardPayload', () => {
    it('checks clipboard type length without materializing the type list', () => {
        const types = new Proxy({ length: 1 }, {
            get(target, property) {
                if (property === 'length') return target.length;
                throw new Error(`Unexpected clipboard type access: ${String(property)}`);
            },
        });

        const event = {
            clipboardData: {
                getData: () => '',
                types,
            },
        } as unknown as ClipboardEvent;

        expect(hasClipboardPayload(event)).toBe(true);
    });
});
