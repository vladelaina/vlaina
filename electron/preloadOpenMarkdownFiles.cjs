const MAX_PENDING_OPEN_MARKDOWN_FILES = 32;
const MAX_OPEN_MARKDOWN_FILE_PATH_CHARS = 8192;
const OPEN_MARKDOWN_FILE_EXTENSION_PATTERN = /\.(?:md|markdown|mdown|mkd)$/i;
const UNSAFE_OPEN_MARKDOWN_FILE_PATH_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const pendingOpenMarkdownFiles = [];
const openMarkdownFileListeners = new Set();

function isSafeOpenMarkdownFilePath(filePath) {
  return (
    typeof filePath === 'string' &&
    filePath.length > 0 &&
    filePath.length <= MAX_OPEN_MARKDOWN_FILE_PATH_CHARS &&
    OPEN_MARKDOWN_FILE_EXTENSION_PATTERN.test(filePath) &&
    !UNSAFE_OPEN_MARKDOWN_FILE_PATH_PATTERN.test(filePath)
  );
}

function installOpenMarkdownFileHandler(ipcRenderer) {
  ipcRenderer.on('desktop:app:open-markdown-file', (_event, filePath) => {
    if (!isSafeOpenMarkdownFilePath(filePath)) {
      return;
    }

    if (openMarkdownFileListeners.size === 0) {
      if (pendingOpenMarkdownFiles.length >= MAX_PENDING_OPEN_MARKDOWN_FILES) {
        pendingOpenMarkdownFiles.shift();
      }
      pendingOpenMarkdownFiles.push(filePath);
      return;
    }

    for (const listener of openMarkdownFileListeners) {
      listener(filePath);
    }
  });
}

function onOpenMarkdownFile(callback, callIpcCallback) {
  const listener = (filePath) => callIpcCallback(callback, filePath);
  openMarkdownFileListeners.add(listener);

  while (pendingOpenMarkdownFiles.length > 0) {
    listener(pendingOpenMarkdownFiles.shift());
  }

  return () => {
    openMarkdownFileListeners.delete(listener);
  };
}

module.exports = {
  installOpenMarkdownFileHandler,
  onOpenMarkdownFile,
};
