import { isLocalNetworkHttpUrl, sanitizeNoteLinkHref } from '@/lib/notes/markdown/urlSecurity';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { BARE_DOMAIN_HREF_PATTERN } from './constants';

const EMAIL_ADDRESS_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const EXPLICIT_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;

function getHrefPathWithoutFragmentOrQuery(value: string): string {
    const hashIndex = value.indexOf('#');
    const queryIndex = value.indexOf('?');
    const endIndexes = [hashIndex, queryIndex].filter((index) => index >= 0);
    return value.slice(0, endIndexes.length > 0 ? Math.min(...endIndexes) : value.length);
}

function trimLinkHref(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function isExplicitMarkdownFileHref(value: string): boolean {
    const trimmed = value.trim();
    return Boolean(
        trimmed &&
        !trimmed.startsWith('//') &&
        !EXPLICIT_SCHEME_PATTERN.test(trimmed) &&
        isSupportedMarkdownPath(getHrefPathWithoutFragmentOrQuery(trimmed))
    );
}

export function sanitizeEditorExternalLinkHref(value: unknown): string | null {
    const trimmed = trimLinkHref(value);
    const href = trimmed.startsWith('www.')
        ? `https://${trimmed}`
        : BARE_DOMAIN_HREF_PATTERN.test(trimmed)
            ? `https://${trimmed}`
            : EMAIL_ADDRESS_PATTERN.test(trimmed)
                ? `mailto:${trimmed}`
                : trimmed;
    const safeHref = sanitizeNoteLinkHref(href);
    if (!safeHref || !/^(https?:\/\/|mailto:)/i.test(safeHref)) return null;
    if (/^https?:\/\//i.test(safeHref) && isLocalNetworkHttpUrl(safeHref)) return null;
    return safeHref;
}

export function sanitizeEditorLinkHref(value: unknown): string | null {
    const externalHref = sanitizeEditorExternalLinkHref(value);
    if (externalHref) {
        return externalHref;
    }

    const trimmed = trimLinkHref(value);
    if (/^(?:\/(?!\/)|#|\.\/|\.\.\/)/.test(trimmed)) {
        return sanitizeNoteLinkHref(trimmed);
    }

    if (trimmed.startsWith('//') || EXPLICIT_SCHEME_PATTERN.test(trimmed)) {
        return sanitizeNoteLinkHref(trimmed);
    }

    return sanitizeNoteLinkHref(trimmed);
}

export function sanitizeExplicitMarkdownLinkHref(value: unknown): string | null {
    const trimmed = trimLinkHref(value);
    if (trimmed.startsWith('//')) {
        return null;
    }

    if (isExplicitMarkdownFileHref(trimmed)) {
        return sanitizeNoteLinkHref(trimmed);
    }

    const externalHref = sanitizeEditorExternalLinkHref(value);
    if (externalHref) {
        return externalHref;
    }

    return sanitizeNoteLinkHref(value);
}
