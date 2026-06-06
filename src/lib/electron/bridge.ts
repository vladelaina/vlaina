export interface ElectronWindowApi {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<boolean>;
  close(): Promise<void>;
  confirmClose(): Promise<void>;
  isMaximized(): Promise<boolean>;
  setResizable(resizable: boolean): Promise<void>;
  setMaximizable(maximizable: boolean): Promise<void>;
  setMinSize(width: number, height: number): Promise<void>;
  setSize(width: number, height: number): Promise<void>;
  center(): Promise<void>;
  getSize(): Promise<{ width: number; height: number }>;
  getLabel(): Promise<string | null>;
  focus(label: string): Promise<boolean>;
  toggleFullscreen(): Promise<boolean>;
  create(options?: Record<string, unknown>): Promise<void>;
  onCloseRequested(callback: () => void): () => void;
}

export interface ElectronShortcutsApi {
  onOpenMarkdownFile(callback: () => void): () => void;
}

export interface ElectronShellApi {
  openExternal(url: string): Promise<void>;
  openPath(filePath: string): Promise<void>;
  trashItem(filePath: string): Promise<void>;
  revealItem(filePath: string): Promise<void>;
}

export interface ElectronDialogApi {
  open(options?: Record<string, unknown>): Promise<string | string[] | null>;
  save(options?: Record<string, unknown>): Promise<string | null>;
  message(
    message: string,
    options?: { title?: string; kind?: 'info' | 'warning' | 'error' }
  ): Promise<void>;
  confirm(
    message: string,
    options?: { title?: string; kind?: 'info' | 'warning' | 'error' }
  ): Promise<boolean>;
}

export interface ElectronClipboardApi {
  writeText(text: string): Promise<void>;
  writeImage?(dataUrl: string): Promise<void>;
}

export interface ElectronMediaApi {
  capturePage(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<string>;
  resolveVideoUrl(url: string): Promise<{
    resolvedUrl: string;
    source: 'unchanged' | 'fallback' | 'bilibili';
    bvid?: string;
    aid?: number | null;
    cid?: number | null;
    page?: number | null;
    error?: string;
    stage?: string;
    timeoutFired?: boolean;
    durationMs?: number;
  }>;
  diagnoseUrl(url: string): Promise<{
    url: string;
    proxy: string;
    proxyConfig: {
      proxyServer: string;
      proxyRules: string;
      source: string;
    } | null;
  }>;
}

export interface ElectronAppApi {
  getVersion(): Promise<string>;
  setLanguage?(language: string): Promise<boolean>;
  onOpenMarkdownFile?(callback: (filePath: string) => void): () => void;
  reportStartupReady?(): void;
}

export interface ElectronUpdateApi {
  check(): Promise<{
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    downloadUrl: string;
    releaseUrl: string;
    platformAssetName: string;
    hasPlatformAsset: boolean;
    releaseNotes: string;
    publishedAt: string;
  }>;
}

export interface ElectronExportApi {
  htmlToPdf(html: string, options?: {
    title?: string;
    pageSize?: 'A4' | 'Letter';
    landscape?: boolean;
  }): Promise<Uint8Array>;
}

export interface ElectronAIProviderHttpApi {
  startRequest(
    requestId: string,
    request: {
      url: string;
      method: 'GET' | 'POST';
      headers?: Record<string, string>;
      body?: string;
      bodyBase64?: string;
    }
  ): Promise<{
    status: number;
    statusText: string;
    headers: Array<[string, string]>;
  }>;
  cancelRequest(requestId: string): Promise<void>;
  onRequestChunk(requestId: string, callback: (chunk: number[]) => void): () => void;
  onRequestDone(requestId: string, callback: () => void): () => void;
  onRequestError(requestId: string, callback: (payload: { message: string }) => void): () => void;
}

export interface ElectronWebSearchApi {
  search(query: string, options?: {
    category?: string;
    timeRange?: string;
    limit?: number;
  }, requestId?: string): Promise<{
    query: string;
    results: Array<{
      title: string;
      url: string;
      snippet: string;
      publishedAt: string | null;
      source: string | null;
      thumbnail: string | null;
    }>;
  }>;
  read(url: string, options?: { contentLimit?: number; retries?: number }, requestId?: string): Promise<{
    title: string;
    summary: string;
    siteName: string;
    finalUrl: string;
    content: string;
    charCount: number;
  }>;
  readBatch(urls: string[], options?: { contentLimit?: number; retries?: number }, requestId?: string): Promise<Array<{
    url: string;
    ok: boolean;
    page?: {
      title: string;
      summary: string;
      siteName: string;
      finalUrl: string;
      content: string;
      charCount: number;
    };
    error?: string;
    code?: string;
  }>>;
  cancelRequest(requestId: string): Promise<boolean>;
}

export interface ElectronDragDropApi {
  getPathForFile(file: File): string;
  authorizePath(filePath: string): Promise<{
    name: string;
    path: string;
    isDirectory: boolean;
    isFile: boolean;
    size?: number;
    modifiedAt?: number;
  }>;
}

export interface ElectronFsApi {
  readBinaryFile(filePath: string): Promise<Uint8Array>;
  readTextFile(filePath: string): Promise<string>;
  writeBinaryFile(filePath: string, bytes: Uint8Array): Promise<void>;
  writeTextFile(
    filePath: string,
    content: string,
    options?: { recursive?: boolean; append?: boolean }
  ): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  mkdir(filePath: string, recursive?: boolean): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  deleteDir(filePath: string, recursive?: boolean): Promise<void>;
  listDir(filePath: string): Promise<Array<{
    name: string;
    path: string;
    isDirectory: boolean;
    isFile: boolean;
  }>>;
  rename(oldPath: string, newPath: string): Promise<void>;
  copyFile(sourcePath: string, targetPath: string): Promise<void>;
  stat(filePath: string): Promise<{
    name: string;
    path: string;
    isDirectory: boolean;
    isFile: boolean;
    size?: number;
    modifiedAt?: number;
  } | null>;
  watch(
    filePath: string,
    callback: (payload: {
      type:
        | { remove: { kind: string } }
        | { create: { kind: string } }
        | { modify: { kind: string; mode?: string } };
      paths: string[];
    }) => void | Promise<void>,
    options?: { recursive?: boolean }
  ): Promise<() => Promise<void>>;
}

export interface ElectronPathApi {
  join(...segments: string[]): Promise<string>;
  appDataDir(): Promise<string>;
  homeDir(): Promise<string>;
  toFileUrl(filePath: string): Promise<string>;
}

export interface ElectronSecretsApi {
  getAIProviderSecrets(providerIds: string[]): Promise<Record<string, string>>;
  setAIProviderSecret(providerId: string, apiKey: string): Promise<void>;
  deleteAIProviderSecret(providerId: string): Promise<void>;
}

export interface ElectronAccountApi {
  getSessionStatus(): Promise<{
    connected: boolean;
    provider: string | null;
    username: string | null;
    primaryEmail: string | null;
    avatarUrl: string | null;
    membershipTier: string | null;
    membershipName: string | null;
    sessionInvalidated?: boolean;
    persistent?: boolean;
    budget?: {
      active?: unknown;
      usedPercent?: unknown;
      remainingPercent?: unknown;
      status?: unknown;
    } | null;
  }>;
  startAuth(provider: string): Promise<{
    success: boolean;
    provider: string | null;
    username: string | null;
    primaryEmail: string | null;
    avatarUrl: string | null;
    error: string | null;
  }>;
  cancelAuth?(): Promise<boolean>;
  requestEmailCode(email: string): Promise<boolean>;
  verifyEmailCode(email: string, code: string): Promise<{
    success: boolean;
    provider: string | null;
    username: string | null;
    primaryEmail: string | null;
    avatarUrl: string | null;
    error: string | null;
  }>;
  disconnect(): Promise<void>;
  createBillingCheckout(tier: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }>;
  submitFeedback(message: string): Promise<{
    success: boolean;
    error?: string;
  }>;
  getManagedModels(): Promise<Record<string, unknown>>;
  getManagedModelsVersion(): Promise<Record<string, unknown>>;
  getManagedBudget(): Promise<Record<string, unknown>>;
  managedChatCompletion(body: object, requestId?: string): Promise<Record<string, unknown>>;
  cancelManagedChatCompletion(requestId: string): Promise<void>;
  managedImageGeneration(body: object, requestId?: string): Promise<Record<string, unknown>>;
  cancelManagedImageGeneration(requestId: string): Promise<void>;
  managedImageEdit(payload: { bodyBase64: string; headers: Record<string, string> }, requestId?: string): Promise<Record<string, unknown>>;
  cancelManagedImageEdit(requestId: string): Promise<void>;
  startManagedChatCompletionStream(requestId: string, body: Record<string, unknown>): Promise<void>;
  cancelManagedChatCompletionStream(requestId: string): Promise<void>;
  onManagedStreamChunk(requestId: string, callback: (content: string) => void): () => void;
  onManagedStreamDone(
    requestId: string,
    callback: (payload: { content: string }) => void
  ): () => void;
  onManagedStreamError(
    requestId: string,
    callback: (payload: { message: string; statusCode?: number; errorCode?: string }) => void
  ): () => void;
}

export interface DesktopApi {
  platform: 'electron';
  getPlatform(): Promise<'electron'>;
  window: ElectronWindowApi;
  shortcuts: ElectronShortcutsApi;
  shell: ElectronShellApi;
  clipboard: ElectronClipboardApi;
  media?: ElectronMediaApi;
  app?: ElectronAppApi;
  update?: ElectronUpdateApi;
  export: ElectronExportApi;
  aiProvider: ElectronAIProviderHttpApi;
  webSearch?: ElectronWebSearchApi;
  dragDrop: ElectronDragDropApi;
  dialog: ElectronDialogApi;
  fs: ElectronFsApi;
  path: ElectronPathApi;
  secrets: ElectronSecretsApi;
  account: ElectronAccountApi;
}

export function getElectronBridge(): DesktopApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.vlainaDesktop ?? null;
}

export function isElectronRuntime(): boolean {
  return getElectronBridge()?.platform === 'electron';
}
