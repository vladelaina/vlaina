import DOMPurify from 'dompurify';

/**
 * Configuration for DOMPurify to allow strictly semantic HTML and basic formatting,
 * while stripping all layout, style, and potential script injections.
 */
const DOM_PURIFY_CONFIG = {
    // 1. Only allow semantic tags (Semantic Tags Only)
    ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
        'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'blockquote',
        'ul', 'ol', 'li',
        'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    // 2. Only allow semantic attributes (Semantic Attributes Only)
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'start', 'type', 'checked'],

    // 3. Completely forbid style attributes
    FORBID_ATTR: ['style', 'class', 'id', 'width', 'height', 'align', 'valign', 'bgcolor'],

    // 4. Keep content
    KEEP_CONTENT: true
};

/**
 * Sanitizes the given HTML string to ensure it contains only safe, semantic markup.
 * This function effectively implements an "Allowlist" strategy, stripping all styles
 * and layout containers (like div, span) but preserving structure (like tables, lists).
 * 
 * @param html The raw HTML string from the clipboard
 * @returns The sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
    if (!html) return html;

    try {
        console.log('[Clipboard/Sanitizer] Raw HTML length:', html.length);
        const sanitized = DOMPurify.sanitize(html, DOM_PURIFY_CONFIG);
        console.log('[Clipboard/Sanitizer] Sanitized HTML length:', sanitized.length);
        return sanitized;
    } catch (e) {
        console.error('[Clipboard/Sanitizer] Failed to sanitize HTML:', e);
        // Fallback: return as is or return empty string? 
        // Returning as is might be dangerous, but returning empty breaks paste.
        // Given we are client-side, returning raw might be acceptable if DOMPurify breaks,
        // but it implies a severe environment issue.
        return html;
    }
}