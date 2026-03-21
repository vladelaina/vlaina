import { beforeEach, describe, expect, it } from 'vitest';
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
      notesPreviewTitle: null,
      drawerOpen: false,
      searchQuery: '',
      selectedTag: null,
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

  it('persists selected tag filter', () => {
    useUIStore.getState().setSelectedTag('Deep Work');
    expect(useUIStore.getState().selectedTag).toBe('Deep Work');

    useUIStore.getState().setSelectedTag(null);
    expect(useUIStore.getState().selectedTag).toBeNull();
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
