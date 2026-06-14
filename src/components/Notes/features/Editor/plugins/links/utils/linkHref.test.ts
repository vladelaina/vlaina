import { describe, expect, it } from 'vitest';
import {
    sanitizeEditorExternalLinkHref,
    sanitizeEditorLinkHref,
    sanitizeExplicitMarkdownLinkHref,
} from './linkHref';

describe('linkHref sanitizers', () => {
    it('rejects non-string href values without coercion', () => {
        const href = {
            toString() {
                throw new Error('href coercion');
            },
        };

        expect(sanitizeEditorExternalLinkHref(href)).toBeNull();
        expect(sanitizeEditorLinkHref(href)).toBeNull();
        expect(sanitizeExplicitMarkdownLinkHref(href)).toBeNull();
    });
});
