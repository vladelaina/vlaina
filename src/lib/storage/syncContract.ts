export type SyncPersistence =
  | 'split-files'
  | 'notes-root-files'
  | 'localStorage'
  | 'sessionStorage'
  | 'broadcast'
  | 'runtime';

export type SyncScope =
  | 'document'
  | 'shared-config'
  | 'shared-cache'
  | 'shared-identity'
  | 'window-preference'
  | 'window-session'
  | 'coordination'
  | 'transport';

export type SyncMergePolicy =
  | 'three-way-merge'
  | 'field-patch'
  | 'tombstone-wins'
  | 'preserve-disk'
  | 'reload-from-source'
  | 'newest-snapshot'
  | 'last-writer-wins'
  | 'runtime-lock'
  | 'session-isolated'
  | 'notify-only';

export type StorageAutoSyncKind = 'unified' | 'chat-session' | 'ui-preferences' | 'notes-starred';

export interface SyncContractEntry {
  id: string;
  owner: string;
  scope: SyncScope;
  persistence: SyncPersistence[];
  mergePolicy: SyncMergePolicy;
  storageKeys?: string[];
  storageKeyPrefixes?: string[];
  broadcastChannels?: string[];
  autoSyncKinds?: StorageAutoSyncKind[];
  crossWindow: boolean;
  notes: string;
}

export const STORAGE_AUTO_SYNC_KINDS: readonly StorageAutoSyncKind[] = [
  'unified',
  'chat-session',
  'ui-preferences',
  'notes-starred',
] as const;

export const SYNC_CONTRACTS: readonly SyncContractEntry[] = [
  {
    id: 'notes.documents',
    owner: 'notes',
    scope: 'document',
    persistence: ['notes-root-files', 'broadcast', 'localStorage'],
    mergePolicy: 'three-way-merge',
    storageKeys: ['vlaina-notes-external-path-event'],
    broadcastChannels: ['vlaina-notes-external-path'],
    crossWindow: true,
    notes: 'Markdown note edits use baseline/local/disk merge; external rename/delete/content changes are watcher or focus-poll driven.',
  },
  {
    id: 'notes.starred',
    owner: 'notes',
    scope: 'shared-config',
    persistence: ['split-files'],
    mergePolicy: 'reload-from-source',
    autoSyncKinds: ['notes-starred'],
    crossWindow: true,
    notes: 'Starred registry changes broadcast a reload event; close guard flushes pending writes.',
  },
  {
    id: 'notes.preferences',
    owner: 'notes',
    scope: 'window-preference',
    persistence: ['localStorage'],
    mergePolicy: 'reload-from-source',
    storageKeys: ['vlaina-recent-notes', 'vlaina-note-icon-size'],
    crossWindow: true,
    notes: 'Notes store listens for storage events and reloads recent notes and global icon size.',
  },
  {
    id: 'notes.scroll-positions',
    owner: 'notes',
    scope: 'window-preference',
    persistence: ['localStorage'],
    mergePolicy: 'last-writer-wins',
    storageKeys: ['vlaina-note-scroll-positions'],
    crossWindow: true,
    notes: 'Editor scroll positions are a bounded localStorage cache keyed by note identity; other windows observe the latest saved value on restore.',
  },
  {
    id: 'notes.workspace',
    owner: 'notes',
    scope: 'shared-config',
    persistence: ['notes-root-files'],
    mergePolicy: 'field-patch',
    crossWindow: true,
    notes: 'Workspace snapshots are restore points; expanded folders merge while current note remains last-writer-wins.',
  },
  {
    id: 'notes.assets',
    owner: 'notes',
    scope: 'shared-cache',
    persistence: ['notes-root-files'],
    mergePolicy: 'reload-from-source',
    crossWindow: true,
    notes: 'Asset library reloads from the active notesRoot or absolute note scope and ignores stale refreshes.',
  },
  {
    id: 'unified.main',
    owner: 'unified',
    scope: 'shared-config',
    persistence: ['split-files'],
    mergePolicy: 'field-patch',
    autoSyncKinds: ['unified'],
    crossWindow: true,
    notes: 'Settings save via explicit patches; non-settings writes preserve disk settings and custom-icon tombstones win.',
  },
  {
    id: 'chat.sessions',
    owner: 'chat',
    scope: 'document',
    persistence: ['split-files'],
    mergePolicy: 'preserve-disk',
    autoSyncKinds: ['chat-session', 'unified'],
    crossWindow: true,
    notes: 'Session metadata and message files merge stale writes; active session message reload is deferred during generation.',
  },
  {
    id: 'sync.transport',
    owner: 'storage',
    scope: 'transport',
    persistence: ['localStorage', 'broadcast'],
    mergePolicy: 'notify-only',
    storageKeys: ['vlaina-storage-sync-event'],
    broadcastChannels: ['vlaina-storage-sync'],
    crossWindow: true,
    notes: 'Storage auto-sync events use BroadcastChannel with localStorage fallback; sourceId prevents self-reload loops.',
  },
  {
    id: 'ai.providers',
    owner: 'ai',
    scope: 'shared-config',
    persistence: ['split-files'],
    mergePolicy: 'tombstone-wins',
    autoSyncKinds: ['unified'],
    crossWindow: true,
    notes: 'AI providers are split files; deleted provider tombstones remove stale provider files and secrets.',
  },
  {
    id: 'ai.provider-benchmark',
    owner: 'ai',
    scope: 'shared-cache',
    persistence: ['split-files', 'runtime'],
    mergePolicy: 'reload-from-source',
    autoSyncKinds: ['unified'],
    crossWindow: true,
    notes: 'Persisted benchmark results refresh open Settings UI unless a local benchmark runner snapshot is active.',
  },
  {
    id: 'ai.session-mutation-locks',
    owner: 'ai',
    scope: 'coordination',
    persistence: ['localStorage', 'broadcast'],
    mergePolicy: 'runtime-lock',
    storageKeyPrefixes: ['vlaina-session-mutation-lock:'],
    broadcastChannels: ['vlaina-session-mutation-lock'],
    crossWindow: true,
    notes: 'Per-session chat mutations use expiring localStorage locks with BroadcastChannel notification.',
  },
  {
    id: 'ui.preferences',
    owner: 'ui',
    scope: 'window-preference',
    persistence: ['localStorage'],
    mergePolicy: 'reload-from-source',
    storageKeys: [
      'fontSize',
      'vlaina-notes-sidebar-collapsed',
      'vlaina_sidebar_width',
      'vlaina_image_storage_mode',
      'vlaina_image_subfolder_name',
      'vlaina_image_notesRoot_subfolder_name',
      'vlaina_image_filename_format',
      'vlaina-language-preference',
      'vlaina_last_app_view_mode',
      'vlaina_notes_chat_panel_collapsed',
      'vlaina_notes_chat_panel_width_v2',
      'vlaina_notes_chat_floating_size',
    ],
    autoSyncKinds: ['ui-preferences'],
    crossWindow: true,
    notes: 'UI store reloads preferences on ui-preferences events; resizable panels listen to storage directly.',
  },
  {
    id: 'icon-picker.preferences',
    owner: 'ui',
    scope: 'window-preference',
    persistence: ['localStorage'],
    mergePolicy: 'reload-from-source',
    storageKeys: [
      'vlaina-recent-icons',
      'vlaina-emoji-skin-tone',
      'vlaina-icon-color',
      'vlaina-icon-picker-tab',
      'vlaina-icon-picker-debug',
    ],
    crossWindow: true,
    notes: 'Icon picker listens for storage updates, sanitizes recent icons and skin tone, and shares the debug logging toggle.',
  },
  {
    id: 'whiteboard.snapshot',
    owner: 'whiteboard',
    scope: 'document',
    persistence: ['localStorage'],
    mergePolicy: 'last-writer-wins',
    storageKeys: ['vlaina:whiteboard:v1'],
    crossWindow: false,
    notes: 'Whiteboard state is a single local snapshot loaded on mount; open windows do not live-merge edits.',
  },
  {
    id: 'graph.layout',
    owner: 'graph',
    scope: 'window-preference',
    persistence: ['localStorage'],
    mergePolicy: 'last-writer-wins',
    storageKeys: ['vlaina-graph-ui'],
    crossWindow: false,
    notes: 'Graph node positions are a notes-root-keyed local layout preference; open windows do not live-merge node dragging.',
  },
  {
    id: 'notesRoot.recent',
    owner: 'notesRoot',
    scope: 'shared-config',
    persistence: ['localStorage', 'split-files', 'broadcast'],
    mergePolicy: 'tombstone-wins',
    storageKeys: ['vlaina-notes-roots', 'vlaina-current-notes-root'],
    broadcastChannels: ['vlaina-notes-root'],
    crossWindow: true,
    notes: 'Recent/opened folder state merges file and localStorage data; external root rename flushes active note before sync.',
  },
  {
    id: 'notesRoot.config',
    owner: 'notesRoot',
    scope: 'shared-config',
    persistence: ['notes-root-files'],
    mergePolicy: 'reload-from-source',
    crossWindow: true,
    notes: 'NotesRoot config is repaired on load, including oversized or invalid files.',
  },
  {
    id: 'managed-ai.budget',
    owner: 'account',
    scope: 'shared-cache',
    persistence: ['localStorage'],
    mergePolicy: 'newest-snapshot',
    storageKeys: ['vlaina-managed-ai-budget'],
    crossWindow: true,
    notes: 'Managed AI budget snapshots carry syncedAt; newer snapshots win and removal clears other windows.',
  },
  {
    id: 'account.identity',
    owner: 'account',
    scope: 'shared-identity',
    persistence: ['localStorage', 'broadcast'],
    mergePolicy: 'reload-from-source',
    storageKeys: ['vlaina_account_identity', 'vlaina_account_status_refresh'],
    broadcastChannels: ['vlaina_account_identity'],
    crossWindow: true,
    notes: 'Account identity updates propagate through BroadcastChannel and storage refresh events.',
  },
  {
    id: 'account.auth-intent',
    owner: 'account',
    scope: 'window-session',
    persistence: ['sessionStorage'],
    mergePolicy: 'session-isolated',
    storageKeys: ['vlaina_auth_state', 'vlaina_auth_provider', 'vlaina_account_session'],
    crossWindow: false,
    notes: 'OAuth/auth intent and web account credentials are per-window session state and must not cross-sync.',
  },
  {
    id: 'billing.return-refresh',
    owner: 'billing',
    scope: 'window-preference',
    persistence: ['localStorage'],
    mergePolicy: 'notify-only',
    storageKeys: ['vlaina.billing.returnRefresh.pendingAt'],
    crossWindow: true,
    notes: 'Billing return is a TTL refresh flag consumed on focus/visibility; it intentionally stores no durable state.',
  },
  {
    id: 'shortcuts.runtime',
    owner: 'shortcuts',
    scope: 'window-preference',
    persistence: ['localStorage'],
    mergePolicy: 'reload-from-source',
    storageKeys: ['vlaina-shortcuts'],
    crossWindow: true,
    notes: 'Shortcut handlers read storage at keydown time, so cross-window changes apply without cached store state.',
  },
  {
    id: 'startup.update-check',
    owner: 'app',
    scope: 'window-preference',
    persistence: ['localStorage'],
    mergePolicy: 'last-writer-wins',
    storageKeys: ['pendingSync', 'autoUpdate', 'vlaina-show-sidebar'],
    crossWindow: false,
    notes: 'Legacy app preference keys are not part of shared document/config sync.',
  },
  {
    id: 'startup.update-throttle',
    owner: 'app',
    scope: 'window-preference',
    persistence: ['localStorage'],
    mergePolicy: 'last-writer-wins',
    storageKeys: ['vlaina:update:lastAutoCheckAt', 'vlaina:update:lastResult'],
    crossWindow: false,
    notes: 'Desktop update check timestamp and cached result are local startup/About UI state, not shared user data.',
  },
  {
    id: 'editor.ai-menu-usage',
    owner: 'notes',
    scope: 'window-preference',
    persistence: ['localStorage'],
    mergePolicy: 'last-writer-wins',
    storageKeys: ['vlaina_editor_ai_menu_usage'],
    crossWindow: false,
    notes: 'AI menu usage ranking is a local convenience preference read when the menu builds.',
  },
  {
    id: 'dev.retry-simulation',
    owner: 'dev',
    scope: 'window-preference',
    persistence: ['localStorage'],
    mergePolicy: 'last-writer-wins',
    storageKeys: ['vlaina_dev_visible_retry_delay_1s', 'vlaina_dev_retry_simulation'],
    crossWindow: false,
    notes: 'Development-only retry simulation toggles persist for local reloads and are not shared app state.',
  },
  {
    id: 'e2e.sync-bridge',
    owner: 'test',
    scope: 'transport',
    persistence: ['localStorage'],
    mergePolicy: 'notify-only',
    storageKeys: ['vlaina:e2e:enabled'],
    crossWindow: true,
    notes: 'Development-only Electron E2E bridge flag lets secondary test windows expose the same test control API.',
  },
] as const;

export function isStorageAutoSyncKind(value: string): value is StorageAutoSyncKind {
  return (STORAGE_AUTO_SYNC_KINDS as readonly string[]).includes(value);
}

export function getKnownSyncStorageKeys(): Set<string> {
  return new Set(SYNC_CONTRACTS.flatMap((entry) => entry.storageKeys || []));
}

export function getKnownSyncStorageKeyPrefixes(): readonly string[] {
  return SYNC_CONTRACTS.flatMap((entry) => entry.storageKeyPrefixes || []);
}

export function getKnownSyncBroadcastChannels(): Set<string> {
  return new Set(SYNC_CONTRACTS.flatMap((entry) => entry.broadcastChannels || []));
}
