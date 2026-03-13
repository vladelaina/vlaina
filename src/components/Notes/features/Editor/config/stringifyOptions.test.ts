import { describe, expect, it } from 'vitest';
import { notesRemarkStringifyOptions } from './stringifyOptions';

describe('notesRemarkStringifyOptions', () => {
    it('uses explicit markdown forms that avoid heading-rule ambiguity', () => {
        expect(notesRemarkStringifyOptions).toEqual({
            bullet: '-',
            rule: '-',
            ruleRepetition: 3,
            setext: false,
        });
    });
});
