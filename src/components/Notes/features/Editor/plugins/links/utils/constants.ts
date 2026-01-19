/**
 * Shared URL patterns for link detection
 */
export const URL_PATTERNS = [
    // Full URLs with protocol: Limit length and avoid nested quantifiers
    /https?:\/\/[\w\-\._~:/?#[\]@!$&'*+,;=%()]{1,2000}/g,
    // URLs starting with www.
    /www\.[\w\-\._~:/?#[\]@!$&'*+,;=%()]{1,2000}/g,
    // Email addresses
    /[\w\-\._%+-]+@[\w\-\._]+\.[a-zA-Z]{2,}/g
];
