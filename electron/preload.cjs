const { contextBridge, ipcRenderer, webUtils } = require('electron');

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
      const handler = () => callback();
      ipcRenderer.on('desktop:window:close-requested', handler);
      return () => {
        ipcRenderer.removeListener('desktop:window:close-requested', handler);
      };
    },
  },
  shortcuts: {
    onOpenMarkdownFile(callback) {
      const channel = 'desktop:shortcut:open-markdown-file';
      const handler = () => callback();
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
    readBinaryFile(filePath) {
      return ipcRenderer.invoke('desktop:fs:read-binary', filePath);
    },
    readTextFile(filePath) {
      return ipcRenderer.invoke('desktop:fs:read-text', filePath);
    },
    writeBinaryFile(filePath, bytes) {
      return ipcRenderer.invoke('desktop:fs:write-binary', filePath, Array.from(bytes));
    },
    writeTextFile(filePath, content, options) {
      return ipcRenderer.invoke('desktop:fs:write-text', filePath, content, options);
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
    watch(filePath, callback) {
      return ipcRenderer.invoke('desktop:fs:watch', filePath).then((watchId) => {
        const channel = `desktop:fs:watch:${watchId}`;
        const handler = (_event, payload) => callback(payload);
        ipcRenderer.on(channel, handler);

        return async () => {
          ipcRenderer.removeListener(channel, handler);
          await ipcRenderer.invoke('desktop:fs:unwatch', watchId);
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
    getAuthDebugLog() {
      return ipcRenderer.invoke('desktop:account:get-auth-debug-log');
    },
    onAuthLog(callback) {
      const channel = 'desktop:account:auth-log';
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
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
    getManagedModels() {
      return ipcRenderer.invoke('desktop:managed:get-models');
    },
    getManagedBudget() {
      return ipcRenderer.invoke('desktop:managed:get-budget');
    },
    managedChatCompletion(body) {
      return ipcRenderer.invoke('desktop:managed:chat-completion', body);
    },
    startManagedChatCompletionStream(requestId, body) {
      return ipcRenderer.invoke('desktop:managed:chat-completion-stream:start', requestId, body);
    },
    cancelManagedChatCompletionStream(requestId) {
      return ipcRenderer.invoke('desktop:managed:chat-completion-stream:cancel', requestId);
    },
    onManagedStreamChunk(requestId, callback) {
      const channel = `desktop:managed:stream:${requestId}:chunk`;
      const handler = (_event, content) => callback(content);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    },
    onManagedStreamDone(requestId, callback) {
      const channel = `desktop:managed:stream:${requestId}:done`;
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    },
    onManagedStreamError(requestId, callback) {
      const channel = `desktop:managed:stream:${requestId}:error`;
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('vlainaDesktop', deepFreeze(desktopApi));
