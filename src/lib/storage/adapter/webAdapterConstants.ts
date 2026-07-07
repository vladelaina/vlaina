export const WEB_ADAPTER_DB_NAME = 'vlaina-storage';
export const WEB_ADAPTER_DB_VERSION = 1;
export const WEB_ADAPTER_STORE_FILES = 'files';
export const WEB_ADAPTER_STORE_DIRS = 'directories';
export const WEB_ADAPTER_PREFIX_RANGE_SUFFIX = '\uffff';
export const WEB_ADAPTER_MARKDOWN_FILE_EXTENSION_PATTERN = /\.(?:md|markdown|mdown|mkd)$/i;
export const WEB_ADAPTER_UNSAFE_LIST_ENTRY_NAME_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
export const MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES = 20_000;
export const MAX_WEB_ADAPTER_LIST_ENTRIES = 20_000;
export const MAX_WEB_ADAPTER_FILE_BYTES = 64 * 1024 * 1024;
export const WEB_ADAPTER_LIST_PRIORITY_BUCKETS = 5;
export const LOW_PRIORITY_WEB_ADAPTER_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);
