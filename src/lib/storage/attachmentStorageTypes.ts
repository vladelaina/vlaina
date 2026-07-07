import { MAX_INLINE_IMAGE_BYTES } from '@/lib/markdown/dataImagePolicy';

export interface Attachment {
    id: string;
    path: string;
    previewUrl: string;
    assetUrl: string;
    name: string;
    type: string;
    size: number;
    textContent?: string;
}

export const DATA_URL_REGEX = /^data:([^;,]+)(;base64)?,(.*)$/i;
export const MAX_ATTACHMENT_IMAGE_BYTES = MAX_INLINE_IMAGE_BYTES;
export const MAX_ATTACHMENT_TEXT_BYTES = 512 * 1024;
export const MAX_ATTACHMENT_TEXT_CHARS = 120_000;

export const SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME: Record<string, readonly string[]> = {
    'image/avif': ['avif'],
    'image/bmp': ['bmp'],
    'image/gif': ['gif'],
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/svg+xml': ['svg'],
    'image/webp': ['webp'],
};
export const SUPPORTED_ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
    Object.entries(SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME).flatMap(([mimeType, extensions]) =>
        extensions.map((extension) => [extension, mimeType])
    )
);
export const SUPPORTED_ATTACHMENT_TEXT_MIME_TYPES = new Set([
    'application/json',
    'application/ld+json',
    'application/toml',
    'application/x-ndjson',
    'application/xml',
    'application/yaml',
    'application/x-yaml',
    'text/css',
    'text/csv',
    'text/html',
    'text/javascript',
    'text/markdown',
    'text/plain',
    'text/tab-separated-values',
    'text/xml',
    'text/x-c',
    'text/x-c++src',
    'text/x-go',
    'text/x-java-source',
    'text/x-python',
    'text/x-ruby',
    'text/x-shellscript',
]);
export const SUPPORTED_ATTACHMENT_TEXT_EXTENSIONS = new Set([
    'bash',
    'c',
    'cc',
    'conf',
    'cpp',
    'cs',
    'css',
    'csv',
    'env',
    'fish',
    'go',
    'h',
    'hpp',
    'html',
    'ini',
    'java',
    'js',
    'json',
    'jsonl',
    'jsx',
    'kt',
    'kts',
    'log',
    'md',
    'markdown',
    'php',
    'ps1',
    'py',
    'rb',
    'rs',
    'sh',
    'sql',
    'swift',
    'toml',
    'ts',
    'tsx',
    'txt',
    'xml',
    'yaml',
    'yml',
    'zsh',
]);
export const SUPPORTED_ATTACHMENT_TEXT_MIME_BY_EXTENSION: Record<string, string> = {
    csv: 'text/csv',
    html: 'text/html',
    js: 'text/javascript',
    json: 'application/json',
    jsonl: 'application/x-ndjson',
    md: 'text/markdown',
    markdown: 'text/markdown',
    toml: 'application/toml',
    txt: 'text/plain',
    xml: 'application/xml',
    yaml: 'application/yaml',
    yml: 'application/yaml',
};

const SUPPORTED_ATTACHMENT_IMAGE_ACCEPT_ITEMS = Object.entries(
    SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME,
).flatMap(([mimeType, extensions]) => [
    mimeType,
    ...extensions.map((extension) => `.${extension}`),
]);
const SUPPORTED_ATTACHMENT_TEXT_ACCEPT_ITEMS = [
    ...SUPPORTED_ATTACHMENT_TEXT_MIME_TYPES,
    ...Array.from(SUPPORTED_ATTACHMENT_TEXT_EXTENSIONS, (extension) => `.${extension}`),
];
export const SUPPORTED_ATTACHMENT_INPUT_ACCEPT = [
    ...SUPPORTED_ATTACHMENT_IMAGE_ACCEPT_ITEMS,
    ...SUPPORTED_ATTACHMENT_TEXT_ACCEPT_ITEMS,
].join(',');
export const SUPPORTED_ATTACHMENT_IMAGE_INPUT_ACCEPT = SUPPORTED_ATTACHMENT_IMAGE_ACCEPT_ITEMS.join(',');

export type AttachmentFileKind = 'image' | 'text';

export interface NormalizedAttachmentFileType {
    kind: AttachmentFileKind;
    mimeType: string;
}

export interface SaveAttachmentOptions {
    persist?: boolean;
}

export interface ConvertAttachmentOptions {
    allowPath?: (path: string) => boolean | Promise<boolean>;
}
