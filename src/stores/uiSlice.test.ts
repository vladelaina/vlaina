import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from './uiSlice';

describe('uiSlice', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({
      appViewMode: 'notes',
      sidebarCollapsed: false,
      sidebarWidth: 280,
      sidebarHeaderHovered: false,
      notesSidebarView: 'workspace',
      fontSize: 16,
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets app view mode within the supported module set', () => {
    useUIStore.getState().setAppViewMode('chat');
    expect(useUIStore.getState().appViewMode).toBe('chat');

    useUIStore.getState().setAppViewMode('lab');
    expect(useUIStore.getState().appViewMode).toBe('lab');
  });

  it('toggles app view mode between notes and chat', () => {
    useUIStore.getState().toggleAppViewMode();
    expect(useUIStore.getState().appViewMode).toBe('chat');

    useUIStore.getState().toggleAppViewMode();
    expect(useUIStore.getState().appViewMode).toBe('notes');
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
    localStorage.setItem('fontSize', '18');
    localStorage.setItem('vlaina-language-preference', 'zh-CN');
    localStorage.setItem('vlaina_image_storage_mode', 'vaultSubfolder');
    localStorage.setItem('vlaina_image_subfolder_name', 'inline-assets');
    localStorage.setItem('vlaina_image_vault_subfolder_name', 'vault-assets');
    localStorage.setItem('vlaina_image_filename_format', 'sequence');

    useUIStore.getState().reloadPreferencesFromStorage();

    expect(useUIStore.getState()).toMatchObject({
      fontSize: 18,
      languagePreference: 'zh-CN',
      imageStorageMode: 'vaultSubfolder',
      imageSubfolderName: 'inline-assets',
      imageVaultSubfolderName: 'vault-assets',
      imageFilenameFormat: 'sequence',
    });
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
