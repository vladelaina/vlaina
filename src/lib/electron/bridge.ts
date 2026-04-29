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
    }) => void | Promise<void>
  ): Promise<() => Promise<void>>;
}

export interface ElectronPathApi {
  join(...segments: string[]): Promise<string>;
  appDataDir(): Promise<string>;
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
  }>;
  getAuthDebugLog(): Promise<Array<{
    timestamp: string;
    event: string;
    details: Record<string, unknown> | null;
  }>>;
  onAuthLog?(
    callback: (payload: {
      timestamp: string;
      event: string;
      details: Record<string, unknown> | null;
    }) => void
  ): () => void;
  startAuth(provider: string): Promise<{
    success: boolean;
    provider: string | null;
    username: string | null;
    primaryEmail: string | null;
    avatarUrl: string | null;
    error: string | null;
  }>;
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
  getManagedModels(): Promise<Record<string, unknown>>;
  getManagedBudget(): Promise<Record<string, unknown>>;
  managedChatCompletion(body: object): Promise<Record<string, unknown>>;
  startManagedChatCompletionStream(requestId: string, body: Record<string, unknown>): Promise<void>;
  cancelManagedChatCompletionStream(requestId: string): Promise<void>;
  onManagedStreamChunk(requestId: string, callback: (content: string) => void): () => void;
  onManagedStreamDone(
    requestId: string,
    callback: (payload: { content: string }) => void
  ): () => void;
  onManagedStreamError(
    requestId: string,
    callback: (payload: { message: string }) => void
  ): () => void;
}

export interface VlainaDesktopApi {
  platform: 'electron';
  getPlatform(): Promise<'electron'>;
  window: ElectronWindowApi;
  shortcuts: ElectronShortcutsApi;
  shell: ElectronShellApi;
  clipboard: ElectronClipboardApi;
  dialog: ElectronDialogApi;
  fs: ElectronFsApi;
  path: ElectronPathApi;
  secrets: ElectronSecretsApi;
  account: ElectronAccountApi;
}

export function getElectronBridge(): VlainaDesktopApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.vlainaDesktop ?? null;
}

export function isElectronRuntime(): boolean {
  return getElectronBridge()?.platform === 'electron';
}
