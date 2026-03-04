import DOMPurify from 'dompurify';

const DOM_PURIFY_CONFIG = {
    ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
        'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'blockquote',
        'ul', 'ol', 'li',
        'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'start', 'type', 'checked'],
    FORBID_ATTR: ['style', 'class', 'id', 'width', 'height', 'align', 'valign', 'bgcolor'],
    KEEP_CONTENT: true
};

export function sanitizeHtml(html: string): string {
    if (!html) return html;

    try {
        return DOMPurify.sanitize(html, DOM_PURIFY_CONFIG);
    } catch (e) {
        console.error('[Clipboard/Sanitizer] Failed to sanitize HTML:', e);
        return html;
    }
}
