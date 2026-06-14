const { contextBridge, ipcRenderer, webUtils } = require('electron');

const IPC_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const MAX_DESKTOP_FS_WRITE_BYTES = 64 * 1024 * 1024;
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

function requireSafeIpcRequestId(value, label) {
  const rawId = primitiveToString(value);
  const id = rawId === null ? '' : rawId.trim();
  if (!IPC_REQUEST_ID_PATTERN.test(id)) {
    throw new Error(`${label} must contain only safe channel characters.`);
  }
  return id;
}

function primitiveToString(value) {
  if (value == null) {
    return '';
  }
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'symbol':
      return String(value);
    default:
      return null;
  }
}

function assertDesktopFsWritePayloadBytes(byteLength) {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > MAX_DESKTOP_FS_WRITE_BYTES) {
    throw new Error('Desktop content is too large to write.');
  }
}

function isUint8ArrayPayload(value) {
  return Object.prototype.toString.call(value) === '[object Uint8Array]';
}

function normalizeDesktopBinaryWritePayload(bytes) {
  if (isUint8ArrayPayload(bytes)) {
    assertDesktopFsWritePayloadBytes(bytes.byteLength);
    return bytes;
  }

  const byteLength = bytes && typeof bytes.length === 'number'
    ? bytes.length
    : Number.NaN;
  assertDesktopFsWritePayloadBytes(byteLength);

  const normalized = new Array(byteLength);
  for (let index = 0; index < byteLength; index += 1) {
    normalized[index] = bytes[index];
  }
  return normalized;
}

function normalizeDesktopTextWritePayload(content) {
  const text = primitiveToString(content);
  if (text === null) {
    throw new Error('Desktop text content must be a primitive value.');
  }
  if (text.length > MAX_DESKTOP_FS_WRITE_BYTES) {
    throw new Error('Desktop content is too large to write.');
  }
  assertDesktopFsWritePayloadBytes(Buffer.byteLength(text, 'utf8'));
  return text;
}

function callIpcCallback(callback, ...args) {
  try {
    Promise.resolve(callback(...args)).catch(() => undefined);
  } catch {
    // Renderer callbacks should not surface as preload IPC listener failures.
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}

const desktopApi = {
  platform: 'electron',
  getPlatform() {
    return ipcRenderer.invoke('desktop:get-platform');
  },
  window: {
    minimize() {
      return ipcRenderer.invoke('desktop:window:minimize');
    },
    toggleMaximize() {
      return ipcRenderer.invoke('desktop:window:maximize-toggle');
    },
    close() {
      return ipcRenderer.invoke('desktop:window:close');
    },
    confirmClose() {
      return ipcRenderer.invoke('desktop:window:confirm-close');
    },
    isMaximized() {
      return ipcRenderer.invoke('desktop:window:is-maximized');
    },
    setResizable(resizable) {
      return ipcRenderer.invoke('desktop:window:set-resizable', resizable);
    },
    setMaximizable(maximizable) {
      return ipcRenderer.invoke('desktop:window:set-maximizable', maximizable);
    },
    setMinSize(width, height) {
      return ipcRenderer.invoke('desktop:window:set-min-size', width, height);
    },
    setSize(width, height) {
      return ipcRenderer.invoke('desktop:window:set-size', width, height);
    },
    center() {
      return ipcRenderer.invoke('desktop:window:center');
    },
    getSize() {
      return ipcRenderer.invoke('desktop:window:get-size');
    },
    getLabel() {
      return ipcRenderer.invoke('desktop:window:get-label');
    },
    focus(label) {
      return ipcRenderer.invoke('desktop:window:focus', label);
    },
    toggleFullscreen() {
      return ipcRenderer.invoke('desktop:window:toggle-fullscreen');
    },
    create(options) {
      return ipcRenderer.invoke('desktop:window:create', options);
    },
    onCloseRequested(callback) {
      const handler = () => callIpcCallback(callback);
      ipcRenderer.on('desktop:window:close-requested', handler);
      return () => {
        ipcRenderer.removeListener('desktop:window:close-requested', handler);
      };
    },
  },
  shortcuts: {
    onOpenMarkdownFile(callback) {
      const channel = 'desktop:shortcut:open-markdown-file';
      const handler = () => callIpcCallback(callback);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    },
  },
  shell: {
    openExternal(url) {
      return ipcRenderer.invoke('desktop:shell:open-external', url);
    },
    openPath(filePath) {
      return ipcRenderer.invoke('desktop:shell:open-path', filePath);
    },
    trashItem(filePath) {
      return ipcRenderer.invoke('desktop:shell:trash-item', filePath);
    },
    revealItem(filePath) {
      return ipcRenderer.invoke('desktop:shell:reveal-item', filePath);
    },
  },
  clipboard: {
    writeText(text) {
      return ipcRenderer.invoke('desktop:clipboard:write-text', text);
    },
    writeImage(dataUrl) {
      return ipcRenderer.invoke('desktop:clipboard:write-image', dataUrl);
    },
  },
  media: {
    resolveVideoUrl(url) {
      return ipcRenderer.invoke('desktop:media:resolve-video-url', url);
    },
    diagnoseUrl(url) {
      return ipcRenderer.invoke('desktop:media:diagnose-url', url);
    },
    capturePage(rect) {
      return ipcRenderer.invoke('desktop:media:capture-page', rect);
    },
  },
  app: {
    getVersion() {
      return ipcRenderer.invoke('desktop:get-version');
    },
    setLanguage(language) {
      return ipcRenderer.invoke('desktop:app:set-language', language);
    },
    onOpenMarkdownFile(callback) {
      const listener = (filePath) => callIpcCallback(callback, filePath);
      openMarkdownFileListeners.add(listener);

      while (pendingOpenMarkdownFiles.length > 0) {
        listener(pendingOpenMarkdownFiles.shift());
      }

      return () => {
        openMarkdownFileListeners.delete(listener);
      };
    },
    reportStartupReady() {
      ipcRenderer.send('desktop:startup-ready');
    },
  },
  update: {
    check() {
      return ipcRenderer.invoke('desktop:update:check');
    },
  },
  export: {
    htmlToPdf(html, options) {
      return ipcRenderer.invoke('desktop:export:html-to-pdf', html, options);
    },
  },
  aiProvider: {
    startRequest(requestId, request) {
      return ipcRenderer.invoke('desktop:ai-provider:request:start', requireSafeIpcRequestId(requestId, 'AI provider request id'), request);
    },
    cancelRequest(requestId) {
      return ipcRenderer.invoke('desktop:ai-provider:request:cancel', requireSafeIpcRequestId(requestId, 'AI provider request id'));
    },
    onRequestChunk(requestId, callback) {
      const id = requireSafeIpcRequestId(requestId, 'AI provider request id');
      const channel = `desktop:ai-provider:request:${id}:chunk`;
      const handler = (_event, chunk) => callIpcCallback(callback, chunk);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    },
    onRequestDone(requestId, callback) {
      const id = requireSafeIpcRequestId(requestId, 'AI provider request id');
      const channel = `desktop:ai-provider:request:${id}:done`;
      const handler = () => callIpcCallback(callback);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    },
    onRequestError(requestId, callback) {
      const id = requireSafeIpcRequestId(requestId, 'AI provider request id');
      const channel = `desktop:ai-provider:request:${id}:error`;
      const handler = (_event, payload) => callIpcCallback(callback, payload);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    },
  },
  webSearch: {
    search(query, options, requestId) {
      const id = requestId == null ? undefined : requireSafeIpcRequestId(requestId, 'Web search request id');
      return ipcRenderer.invoke('desktop:web-search:search', query, options, id);
    },
    read(url, options, requestId) {
      const id = requestId == null ? undefined : requireSafeIpcRequestId(requestId, 'Web search request id');
      return ipcRenderer.invoke('desktop:web-search:read', url, options, id);
    },
    readBatch(urls, options, requestId) {
      const id = requestId == null ? undefined : requireSafeIpcRequestId(requestId, 'Web search request id');
      return ipcRenderer.invoke('desktop:web-search:read-batch', urls, options, id);
    },
    cancelRequest(requestId) {
      return ipcRenderer.invoke('desktop:web-search:cancel', requireSafeIpcRequestId(requestId, 'Web search request id'));
    },
  },
  dragDrop: {
    getPathForFile(file) {
      return webUtils.getPathForFile(file);
    },
    authorizePath(filePath) {
      return ipcRenderer.invoke('desktop:drag-drop:authorize-path', filePath);
    },
  },
  dialog: {
    open(options) {
      return ipcRenderer.invoke('desktop:dialog:open', options);
    },
    save(options) {
      return ipcRenderer.invoke('desktop:dialog:save', options);
    },
    message(message, options) {
      return ipcRenderer.invoke('desktop:dialog:message', message, options);
    },
    confirm(message, options) {
      return ipcRenderer.invoke('desktop:dialog:confirm', message, options);
    },
  },
  fs: {
    readBinaryFile(filePath, maxBytes) {
      return ipcRenderer.invoke('desktop:fs:read-binary', filePath, maxBytes);
    },
    readTextFile(filePath, maxBytes) {
      return ipcRenderer.invoke('desktop:fs:read-text', filePath, maxBytes);
    },
    writeBinaryFile(filePath, bytes) {
      return ipcRenderer.invoke('desktop:fs:write-binary', filePath, normalizeDesktopBinaryWritePayload(bytes));
    },
    writeTextFile(filePath, content, options) {
      return ipcRenderer.invoke('desktop:fs:write-text', filePath, normalizeDesktopTextWritePayload(content), options);
    },
    exists(filePath) {
      return ipcRenderer.invoke('desktop:fs:exists', filePath);
    },
    mkdir(filePath, recursive) {
      return ipcRenderer.invoke('desktop:fs:mkdir', filePath, recursive);
    },
    deleteFile(filePath) {
      return ipcRenderer.invoke('desktop:fs:delete-file', filePath);
    },
    deleteDir(filePath, recursive) {
      return ipcRenderer.invoke('desktop:fs:delete-dir', filePath, recursive);
    },
    listDir(filePath) {
      return ipcRenderer.invoke('desktop:fs:list-dir', filePath);
    },
    rename(oldPath, newPath) {
      return ipcRenderer.invoke('desktop:fs:rename', oldPath, newPath);
    },
    copyFile(sourcePath, targetPath) {
      return ipcRenderer.invoke('desktop:fs:copy-file', sourcePath, targetPath);
    },
    stat(filePath) {
      return ipcRenderer.invoke('desktop:fs:stat', filePath);
    },
    watch(filePath, callback, options) {
      return ipcRenderer.invoke('desktop:fs:watch', filePath, options).then((watchId) => {
        const id = requireSafeIpcRequestId(watchId, 'file watch id');
        const channel = `desktop:fs:watch:${id}`;
        const handler = (_event, payload) => callIpcCallback(callback, payload);
        ipcRenderer.on(channel, handler);

        return async () => {
          ipcRenderer.removeListener(channel, handler);
          await ipcRenderer.invoke('desktop:fs:unwatch', id);
        };
      });
    },
  },
  path: {
    join(...segments) {
      return ipcRenderer.invoke('desktop:path:join', ...segments);
    },
    appDataDir() {
      return ipcRenderer.invoke('desktop:path:app-data');
    },
    homeDir() {
      return ipcRenderer.invoke('desktop:path:home');
    },
    toFileUrl(filePath) {
      return ipcRenderer.invoke('desktop:path:to-file-url', filePath);
    },
  },
  secrets: {
    getAIProviderSecrets(providerIds) {
      return ipcRenderer.invoke('desktop:secrets:get-ai-provider-secrets', providerIds);
    },
    setAIProviderSecret(providerId, apiKey) {
      return ipcRenderer.invoke('desktop:secrets:set-ai-provider-secret', providerId, apiKey);
    },
    deleteAIProviderSecret(providerId) {
      return ipcRenderer.invoke('desktop:secrets:delete-ai-provider-secret', providerId);
    },
  },
  account: {
    getSessionStatus() {
      return ipcRenderer.invoke('desktop:account:get-session-status');
    },
    startAuth(provider) {
      return ipcRenderer.invoke('desktop:account:start-auth', provider);
    },
    cancelAuth() {
      return ipcRenderer.invoke('desktop:account:cancel-auth');
    },
    requestEmailCode(email) {
      return ipcRenderer.invoke('desktop:account:request-email-code', email);
    },
    verifyEmailCode(email, code) {
      return ipcRenderer.invoke('desktop:account:verify-email-code', email, code);
    },
    disconnect() {
      return ipcRenderer.invoke('desktop:account:disconnect');
    },
    createBillingCheckout(tier) {
      return ipcRenderer.invoke('desktop:billing:create-checkout', tier);
    },
    submitFeedback(message) {
      return ipcRenderer.invoke('desktop:feedback:submit', message);
    },
    getManagedModels() {
      return ipcRenderer.invoke('desktop:managed:get-models');
    },
    getManagedModelsVersion() {
      return ipcRenderer.invoke('desktop:managed:get-models-version');
    },
    getManagedBudget() {
      return ipcRenderer.invoke('desktop:managed:get-budget');
    },
    managedChatCompletion(body, requestId) {
      if (requestId == null) {
        return ipcRenderer.invoke('desktop:managed:chat-completion', body);
      }
      return ipcRenderer.invoke(
        'desktop:managed:chat-completion',
        requireSafeIpcRequestId(requestId, 'managed chat completion request id'),
        body,
      );
    },
    cancelManagedChatCompletion(requestId) {
      return ipcRenderer.invoke('desktop:managed:chat-completion:cancel', requireSafeIpcRequestId(requestId, 'managed chat completion request id'));
    },
    managedImageGeneration(body, requestId) {
      if (requestId == null) {
        return ipcRenderer.invoke('desktop:managed:image-generation', body);
      }
      return ipcRenderer.invoke(
        'desktop:managed:image-generation',
        requireSafeIpcRequestId(requestId, 'managed image generation request id'),
        body,
      );
    },
    cancelManagedImageGeneration(requestId) {
      return ipcRenderer.invoke('desktop:managed:image-generation:cancel', requireSafeIpcRequestId(requestId, 'managed image generation request id'));
    },
    managedImageEdit(payload, requestId) {
      if (requestId == null) {
        return ipcRenderer.invoke('desktop:managed:image-edit', payload);
      }
      return ipcRenderer.invoke(
        'desktop:managed:image-edit',
        requireSafeIpcRequestId(requestId, 'managed image edit request id'),
        payload,
      );
    },
    cancelManagedImageEdit(requestId) {
      return ipcRenderer.invoke('desktop:managed:image-edit:cancel', requireSafeIpcRequestId(requestId, 'managed image edit request id'));
    },
    startManagedChatCompletionStream(requestId, body) {
      return ipcRenderer.invoke('desktop:managed:chat-completion-stream:start', requireSafeIpcRequestId(requestId, 'managed stream request id'), body);
    },
    cancelManagedChatCompletionStream(requestId) {
      return ipcRenderer.invoke('desktop:managed:chat-completion-stream:cancel', requireSafeIpcRequestId(requestId, 'managed stream request id'));
    },
    onManagedStreamChunk(requestId, callback) {
      const id = requireSafeIpcRequestId(requestId, 'managed stream request id');
      const channel = `desktop:managed:stream:${id}:chunk`;
      const handler = (_event, content) => callIpcCallback(callback, content);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    },
    onManagedStreamDone(requestId, callback) {
      const id = requireSafeIpcRequestId(requestId, 'managed stream request id');
      const channel = `desktop:managed:stream:${id}:done`;
      const handler = (_event, payload) => callIpcCallback(callback, payload);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    },
    onManagedStreamError(requestId, callback) {
      const id = requireSafeIpcRequestId(requestId, 'managed stream request id');
      const channel = `desktop:managed:stream:${id}:error`;
      const handler = (_event, payload) => callIpcCallback(callback, payload);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('vlainaDesktop', deepFreeze(desktopApi));
