import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from './uiSlice';
import { useUnifiedStore } from './unified/useUnifiedStore';

describe('uiSlice', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({
      appViewMode: 'notes',
      sidebarCollapsed: false,
      sidebarWidth: 280,
      sidebarHeaderHovered: false,
      sidebarSearchOpen: false,
      notesSidebarView: 'workspace',
      fontSize: 17,
      languagePreference: 'system',
      notesPreviewTitle: null,
      drawerOpen: false,
      universalPreviewTarget: null,
      universalPreviewIcon: null,
      universalPreviewColor: null,
      universalPreviewTone: null,
      universalPreviewIconSize: null,
      imageStorageMode: 'subfolder',
      imageSubfolderName: 'assets',
      imageVaultSubfolderName: 'assets',
      imageFilenameFormat: 'original',
      notesChatPanelCollapsed: false,
      pendingNotesChatComposerInsert: null,
    });
    useUnifiedStore.setState({
      data: {
        settings: {
          timezone: { offset: 8, city: 'Beijing' },
          markdown: {
            typewriterMode: false,
            codeBlock: { showLineNumbers: true },
          },
          ui: { lastAppViewMode: 'notes' },
        },
        customIcons: [],
        deletedCustomIconIds: [],
        ai: {
          providers: [],
          models: [],
          benchmarkResults: {},
          fetchedModels: {},
          sessions: [],
          messages: {},
          unreadSessionIds: [],
          selectedModelId: null,
          currentSessionId: null,
          temporaryChatEnabled: false,
          customSystemPrompt: '',
          includeTimeContext: true,
          webSearchEnabled: false,
        },
      },
      loaded: false,
      undoStack: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets app view mode within the supported module set', () => {
    useUIStore.getState().setAppViewMode('chat');
    expect(useUIStore.getState().appViewMode).toBe('chat');
    expect(localStorage.getItem('vlaina_last_app_view_mode')).toBe('chat');
    expect(useUnifiedStore.getState().data.settings.ui?.lastAppViewMode).toBe('chat');

    useUIStore.getState().setAppViewMode('lab');
    expect(useUIStore.getState().appViewMode).toBe('lab');
    expect(localStorage.getItem('vlaina_last_app_view_mode')).toBe('chat');
    expect(useUnifiedStore.getState().data.settings.ui?.lastAppViewMode).toBe('chat');
  });

  it('toggles app view mode between notes and chat', () => {
    useUIStore.getState().toggleAppViewMode();
    expect(useUIStore.getState().appViewMode).toBe('chat');
    expect(localStorage.getItem('vlaina_last_app_view_mode')).toBe('chat');
    expect(useUnifiedStore.getState().data.settings.ui?.lastAppViewMode).toBe('chat');

    useUIStore.getState().toggleAppViewMode();
    expect(useUIStore.getState().appViewMode).toBe('notes');
    expect(localStorage.getItem('vlaina_last_app_view_mode')).toBe('notes');
    expect(useUnifiedStore.getState().data.settings.ui?.lastAppViewMode).toBe('notes');
  });

  it('initializes app view mode from the last stored notes or chat view', async () => {
    localStorage.setItem('vlaina_last_app_view_mode', 'chat');
    vi.resetModules();

    const { useUIStore: freshUIStore } = await import('./uiSlice');

    expect(freshUIStore.getState().appViewMode).toBe('chat');
  });

  it('restores last app view mode after unified config loads', () => {
    useUIStore.setState({ appViewMode: 'notes' });
    useUIStore.getState().restoreLastAppViewMode('chat');

    expect(useUIStore.getState().appViewMode).toBe('chat');
    expect(localStorage.getItem('vlaina_last_app_view_mode')).toBe('chat');
  });

  it('tracks notes sidebar view independently from app view mode', () => {
    useUIStore.getState().setNotesSidebarView('outline');
    expect(useUIStore.getState().notesSidebarView).toBe('outline');
    expect(useUIStore.getState().appViewMode).toBe('notes');
  });

  it('persists the selected language preference', () => {
    useUIStore.getState().setLanguagePreference('zh-CN');

    expect(useUIStore.getState().languagePreference).toBe('zh-CN');
    expect(localStorage.getItem('vlaina-language-preference')).toBe('zh-CN');
  });

  it('reloads local settings preferences from storage for external window sync', () => {
    localStorage.setItem('vlaina-notes-sidebar-collapsed', 'true');
    localStorage.setItem('vlaina_sidebar_width', '360');
    localStorage.setItem('fontSize', '18');
    localStorage.setItem('vlaina-language-preference', 'zh-CN');
    localStorage.setItem('vlaina_image_storage_mode', 'vaultSubfolder');
    localStorage.setItem('vlaina_image_subfolder_name', 'inline-assets');
    localStorage.setItem('vlaina_image_vault_subfolder_name', 'vault-assets');
    localStorage.setItem('vlaina_image_filename_format', 'sequence');
    localStorage.setItem('vlaina_notes_chat_panel_collapsed', 'true');

    useUIStore.getState().reloadPreferencesFromStorage();

    expect(useUIStore.getState()).toMatchObject({
      sidebarCollapsed: true,
      sidebarWidth: 360,
      fontSize: 18,
      languagePreference: 'zh-CN',
      imageStorageMode: 'vaultSubfolder',
      imageSubfolderName: 'inline-assets',
      imageVaultSubfolderName: 'vault-assets',
      imageFilenameFormat: 'sequence',
      notesChatPanelCollapsed: true,
    });
  });

  it('resets the appearance font size to the default markdown body size', () => {
    useUIStore.getState().setFontSize(14);
    expect(localStorage.getItem('fontSize')).toBe('14');

    useUIStore.getState().resetFontSize();

    expect(useUIStore.getState().fontSize).toBe(17);
    expect(localStorage.getItem('fontSize')).toBeNull();
  });

  it('clamps the appearance font size to the supported preview range', () => {
    useUIStore.getState().setFontSize(8);
    expect(useUIStore.getState().fontSize).toBe(14);

    useUIStore.getState().setFontSize(40);
    expect(useUIStore.getState().fontSize).toBe(28);
  });

  it('does not persist or broadcast unchanged appearance font size values', () => {
    const setItemSpy = vi.spyOn(localStorage, 'setItem');

    useUIStore.getState().setFontSize(17);

    expect(useUIStore.getState().fontSize).toBe(17);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('updates UI state even when localStorage writes fail', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => {
      useUIStore.getState().toggleSidebar();
      useUIStore.getState().setLanguagePreference('zh-CN');
      useUIStore.getState().setImageStorageMode('vault');
      useUIStore.getState().queueNotesChatComposerInsert('Selected text');
    }).not.toThrow();

    expect(useUIStore.getState()).toMatchObject({
      sidebarCollapsed: true,
      languagePreference: 'zh-CN',
      imageStorageMode: 'vault',
      notesChatPanelCollapsed: false,
    });
    expect(useUIStore.getState().pendingNotesChatComposerInsert?.text).toBe('Selected text');
  });

  it('stores universal preview fields incrementally', () => {
    useUIStore.getState().setUniversalPreview('note-1', {
      icon: 'emoji.book',
      color: 'blue',
      tone: 2,
    });

    useUIStore.getState().setUniversalPreview('note-1', {
      size: 20,
    });

    expect(useUIStore.getState()).toMatchObject({
      universalPreviewTarget: 'note-1',
      universalPreviewIcon: 'emoji.book',
      universalPreviewColor: 'blue',
      universalPreviewTone: 2,
      universalPreviewIconSize: 20,
    });
  });

  it('sanitizes image folder names before persisting', () => {
    useUIStore.getState().setImageSubfolderName('assets:/notes*');
    useUIStore.getState().setImageVaultSubfolderName('vault<>images');

    expect(useUIStore.getState().imageSubfolderName).toBe('assetsnotes');
    expect(useUIStore.getState().imageVaultSubfolderName).toBe('vaultimages');
  });

  it('opens the notes chat panel and queues a composer insert request', () => {
    useUIStore.getState().setNotesChatPanelCollapsed(true);
    useUIStore.getState().queueNotesChatComposerInsert('Selected text');

    const state = useUIStore.getState();
    expect(state.notesChatPanelCollapsed).toBe(false);
    expect(state.pendingNotesChatComposerInsert?.text).toBe('Selected text');
  });

  it('consumes only the matching pending composer insert request', () => {
    useUIStore.getState().queueNotesChatComposerInsert('Selected text');
    const requestId = useUIStore.getState().pendingNotesChatComposerInsert?.id;

    useUIStore.getState().consumePendingNotesChatComposerInsert(-1);
    expect(useUIStore.getState().pendingNotesChatComposerInsert).not.toBeNull();

    useUIStore.getState().consumePendingNotesChatComposerInsert(requestId!);
    expect(useUIStore.getState().pendingNotesChatComposerInsert).toBeNull();
  });
});
