export const BARE_DOMAIN_TLD_SOURCE = String.raw`(?:xn--[A-Za-z0-9-]{2,59}|[A-Za-z]{2,63})`;

const BARE_DOMAIN_SOURCE = String.raw`(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+(?:${BARE_DOMAIN_TLD_SOURCE})(?::\d{1,5})?(?:[/?#][\w\-\._~:/?#[\]@!$&'*+,;=%()]*)?`;

export const BARE_DOMAIN_HREF_PATTERN = new RegExp(`^${BARE_DOMAIN_SOURCE}$`, 'i');

export const URL_PATTERNS = [
    // Full URLs with protocol: Limit length and avoid nested quantifiers
    /https?:\/\/[\w\-\._~:/?#[\]@!$&'*+,;=%()]{1,2000}/g,
    // URLs starting with www.
    /www\.[\w\-\._~:/?#[\]@!$&'*+,;=%()]{1,2000}/g,
    // Email addresses
    /[\w\-\._%+-]+@[\w\-\._]+\.[a-zA-Z]{2,}/g,
    // Bare domains with a syntactically valid TLD, e.g. cati.me or catim.md.
    new RegExp(String.raw`(?<![@\w.-])${BARE_DOMAIN_SOURCE}(?![\w-])`, 'gi'),
];
