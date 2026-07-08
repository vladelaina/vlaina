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

    it('allows weixin links while rejecting unsafe explicit schemes', () => {
        expect(sanitizeEditorLinkHref('weixin://')).toBe('weixin://');
        expect(sanitizeEditorLinkHref('weixin://dl/chat')).toBe('weixin://dl/chat');
        expect(sanitizeExplicitMarkdownLinkHref('weixin://')).toBe('weixin://');
        expect(sanitizeExplicitMarkdownLinkHref('javascript:alert(1)')).toBeNull();
        expect(sanitizeEditorLinkHref('data:text/html,alert(1)')).toBeNull();
    });
});
