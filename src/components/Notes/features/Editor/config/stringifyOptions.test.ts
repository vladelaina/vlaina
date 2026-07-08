import { describe, expect, it } from 'vitest';
import { notesRemarkGfmOptions, notesRemarkStringifyOptions } from './stringifyOptions';

describe('notesRemarkStringifyOptions', () => {
    it('uses explicit markdown forms that avoid heading-rule ambiguity', () => {
        expect(notesRemarkStringifyOptions.bullet).toBe('-');
        expect(notesRemarkStringifyOptions.rule).toBe('-');
        expect(notesRemarkStringifyOptions.ruleRepetition).toBe(3);
        expect(notesRemarkStringifyOptions.setext).toBe(false);
        expect(notesRemarkStringifyOptions.join).toHaveLength(1);
    });

    it('disables table padding that would add user-untyped spaces', () => {
        expect(notesRemarkGfmOptions).toEqual({
            tableCellPadding: false,
            tablePipeAlign: false,
        });
    });
});
