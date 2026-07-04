export const MAX_NOTE_MENTION_COUNT = 3;
export const MAX_NOTE_MENTION_CHARS = 12000;
export const MAX_NOTE_MENTION_READ_BYTES = 512 * 1024;
export const MAX_MENTIONED_NOTES_CONTEXT_CHARS = 120_000;
export const MAX_FOLDER_MENTION_NOTES = 20;
export const MAX_FOLDER_MENTION_NOTE_CANDIDATES = MAX_FOLDER_MENTION_NOTES * 5;
export const MAX_CHAT_MENTION_LOAD_CONCURRENCY = 5;
export const MAX_FOLDER_MARKDOWN_SCAN_DEPTH = 6;
export const MAX_FOLDER_MARKDOWN_SCAN_ENTRIES = 500;
export const MAX_FOLDER_MARKDOWN_TREE_SCAN_ENTRIES = 5000;
export const MAX_FOLDER_MARKDOWN_LISTING_SCAN_ENTRIES = 5000;
export const MAX_FOLDER_LISTING_ENTRIES = 80;
export const MAX_FOLDER_LISTING_SCAN_ENTRIES = 5000;
export const MAX_FOLDER_IMAGE_ATTACHMENTS = 8;
export const MAX_FOLDER_IMAGE_ATTACHMENT_SCAN_ENTRIES = 5000;
export const MAX_FOLDER_IMAGE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const FOLDER_SCAN_PRIORITY_BUCKETS = 4;
export const PROMPT_LABEL_UNSAFE_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]+/g;
export const MAX_PROMPT_LABEL_LENGTH = 240;

export const IMAGE_EXTENSION_MIME_TYPES: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

export const LOW_PRIORITY_FOLDER_MARKDOWN_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);

export const noteMentionUtf8Encoder = new TextEncoder();
