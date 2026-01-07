/** Notes Store - Markdown notes state management */

import { create } from 'zustand';
import { 
  readDir, 
  readTextFile, 
  writeTextFile, 
  mkdir, 
  remove, 
  rename,
  exists,
} from '@tauri-apps/plugin-fs';
import { join, documentDir } from '@tauri-apps/api/path';

export interface NoteFile {
  id: string;
  name: string;
  path: string;
  isFolder: false;
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  isFolder: true;
  children: FileTreeNode[];
  expanded: boolean;
}

export type FileTreeNode = NoteFile | FolderNode;

interface NotesState {
  rootFolder: FolderNode | null;
  currentNote: { path: string; content: string } | null;
  notesPath: string;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  recentNotes: string[];
  openTabs: { path: string; name: string; isDirty: boolean }[];
  noteContentsCache: Map<string, string>;
  starredNotes: string[];
  noteIcons: Map<string, string>;
  displayNames: Map<string, string>;
}

interface NotesActions {
  loadFileTree: () => Promise<void>;
  toggleFolder: (path: string) => void;
  openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
  saveNote: () => Promise<void>;
  createNote: (folderPath?: string) => Promise<string>;
  createNoteWithContent: (folderPath: string | undefined, name: string, content: string) => Promise<string>;
  deleteNote: (path: string) => Promise<void>;
  renameNote: (path: string, newName: string) => Promise<void>;
  createFolder: (parentPath: string, name: string) => Promise<void>;
  deleteFolder: (path: string) => Promise<void>;
  moveItem: (sourcePath: string, targetFolderPath: string) => Promise<void>;
  updateContent: (content: string) => void;
  closeNote: () => void;
  closeTab: (path: string) => Promise<void>;
  switchTab: (path: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  scanAllNotes: () => Promise<void>;
  getBacklinks: (notePath: string) => { path: string; name: string; context: string }[];
  getAllTags: () => { tag: string; count: number }[];
  toggleStarred: (path: string) => void;
  isStarred: (path: string) => boolean;
  getNoteIcon: (path: string) => string | undefined;
  setNoteIcon: (path: string, emoji: string | null) => void;
  syncDisplayName: (path: string, title: string) => void;
  getDisplayName: (path: string) => string;
}

type NotesStore = NotesState & NotesActions;

const DEFAULT_NOTES_FOLDER = 'NekoTick/notes';
const RECENT_NOTES_KEY = 'nekotick-recent-notes';
const STARRED_NOTES_KEY = 'nekotick-starred-notes';
const MAX_RECENT_NOTES = 10;

// Dynamic vault path - set by useVaultStore
let currentVaultPath: string | null = null;

export function setCurrentVaultPath(path: string | null): void {
  currentVaultPath = path;
}

export function getCurrentVaultPath(): string | null {
  return currentVaultPath;
}

function loadRecentNotes(): string[] {
  try {
    const saved = localStorage.getItem(RECENT_NOTES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function loadStarredNotes(): string[] {
  try {
    const saved = localStorage.getItem(STARRED_NOTES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveStarredNotes(paths: string[]): void {
  try {
    localStorage.setItem(STARRED_NOTES_KEY, JSON.stringify(paths));
  } catch { /* ignore */ }
}

const NOTE_ICONS_KEY = 'nekotick-note-icons';

function loadNoteIcons(): Map<string, string> {
  try {
    const saved = localStorage.getItem(NOTE_ICONS_KEY);
    if (saved) {
      const obj = JSON.parse(saved);
      return new Map(Object.entries(obj));
    }
    return new Map();
  } catch {
    return new Map();
  }
}

function saveNoteIcons(icons: Map<string, string>): void {
  try {
    const obj = Object.fromEntries(icons);
    localStorage.setItem(NOTE_ICONS_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}

function saveRecentNotes(paths: string[]): void {
  try {
    localStorage.setItem(RECENT_NOTES_KEY, JSON.stringify(paths));
  } catch { /* ignore */ }
}

function addToRecentNotes(path: string, current: string[]): string[] {
  const filtered = current.filter(p => p !== path);
  const updated = [path, ...filtered].slice(0, MAX_RECENT_NOTES);
  saveRecentNotes(updated);
  return updated;
}

async function getNotesBasePath(): Promise<string> {
  // Use dynamic vault path if set
  if (currentVaultPath) {
    return currentVaultPath;
  }
  // Fallback to default path
  const docDir = await documentDir();
  return await join(docDir, DEFAULT_NOTES_FOLDER);
}

async function ensureNotesFolder(basePath: string): Promise<void> {
  const folderExists = await exists(basePath);
  if (!folderExists) {
    await mkdir(basePath, { recursive: true });
  }
}

async function buildFileTree(basePath: string, relativePath: string = ''): Promise<FileTreeNode[]> {
  const fullPath = relativePath ? await join(basePath, relativePath) : basePath;
  const entries = await readDir(fullPath);
  
  const nodes: FileTreeNode[] = [];
  
  for (const entry of entries) {
    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    
    if (entry.isDirectory) {
      const children = await buildFileTree(basePath, entryPath);
      nodes.push({
        id: entryPath,
        name: entry.name,
        path: entryPath,
        isFolder: true,
        children,
        expanded: false,
      });
    } else if (entry.name.endsWith('.md')) {
      nodes.push({
        id: entryPath,
        name: entry.name.replace(/\.md$/, ''),
        path: entryPath,
        isFolder: false,
      });
    }
  }
  
  return sortFileTree(nodes);
}

export function sortFileTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

function updateFileNodePath(nodes: FileTreeNode[], oldPath: string, newPath: string, newName: string): FileTreeNode[] {
  return nodes.map(node => {
    if (node.isFolder) {
      return { ...node, children: updateFileNodePath(node.children, oldPath, newPath, newName) };
    }
    if (node.path === oldPath) {
      return { ...node, id: newPath, path: newPath, name: newName };
    }
    return node;
  });
}

function updateFolderExpanded(nodes: FileTreeNode[], targetPath: string): FileTreeNode[] {
  return nodes.map(node => {
    if (node.isFolder) {
      if (node.path === targetPath) {
        return { ...node, expanded: !node.expanded };
      }
      return { ...node, children: updateFolderExpanded(node.children, targetPath) };
    }
    return node;
  });
}

function collectExpandedPaths(nodes: FileTreeNode[]): Set<string> {
  const expandedPaths = new Set<string>();
  const collect = (nodes: FileTreeNode[]) => {
    for (const node of nodes) {
      if (node.isFolder) {
        if (node.expanded) {
          expandedPaths.add(node.path);
        }
        collect(node.children);
      }
    }
  };
  collect(nodes);
  return expandedPaths;
}

function restoreExpandedState(nodes: FileTreeNode[], expandedPaths: Set<string>): FileTreeNode[] {
  return nodes.map(node => {
    if (node.isFolder) {
      return {
        ...node,
        expanded: expandedPaths.has(node.path),
        children: restoreExpandedState(node.children, expandedPaths),
      };
    }
    return node;
  });
}

function extractFirstH1(content: string): string | null {
  const firstLineEnd = content.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? content : content.substring(0, firstLineEnd);
  
  const match = firstLine.match(/^#\s+(.+)$/);
  if (match && match[1]) {
    let title = match[1].trim();
    if (title === 'Title' || title === '') {
      return null;
    }
    title = title.replace(/[<>:"/\\|?*]/g, '');
    title = title.trim();
    return title || null;
  }
  return null;
}

function sanitizeFileName(name: string): string {
  let sanitized = name.replace(/[<>:"/\\|?*]/g, '');
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
  return sanitized || 'Untitled';
}

function updateDisplayName(
  set: (fn: (state: NotesStore) => Partial<NotesStore>) => void,
  path: string,
  name: string
): void {
  set((state) => {
    if (state.displayNames.get(path) === name) return {};
    const updatedDisplayNames = new Map(state.displayNames);
    updatedDisplayNames.set(path, name);
    
    // Also update tab name if open
    const updatedTabs = state.openTabs.map(tab => 
      tab.path === path ? { ...tab, name } : tab
    );
    
    return { displayNames: updatedDisplayNames, openTabs: updatedTabs };
  });
}

function removeDisplayNameInternal(
  set: (fn: (state: NotesStore) => Partial<NotesStore>) => void,
  path: string
): void {
  set((state) => {
    if (!state.displayNames.has(path)) return {};
    const updatedDisplayNames = new Map(state.displayNames);
    updatedDisplayNames.delete(path);
    return { displayNames: updatedDisplayNames };
  });
}

function moveDisplayNameInternal(
  set: (fn: (state: NotesStore) => Partial<NotesStore>) => void,
  oldPath: string,
  newPath: string
): void {
  set((state) => {
    const displayName = state.displayNames.get(oldPath);
    if (!displayName && !state.displayNames.has(oldPath)) return {};
    
    const updatedDisplayNames = new Map(state.displayNames);
    updatedDisplayNames.delete(oldPath);
    if (displayName) {
      updatedDisplayNames.set(newPath, displayName);
    }
    return { displayNames: updatedDisplayNames };
  });
}

export const useNotesStore = create<NotesStore>()((set, get) => ({
  rootFolder: null,
  currentNote: null,
  notesPath: '',
  isDirty: false,
  isLoading: false,
  error: null,
  recentNotes: loadRecentNotes(),
  openTabs: [],
  noteContentsCache: new Map(),
  starredNotes: loadStarredNotes(),
  noteIcons: loadNoteIcons(),
  displayNames: new Map(),

  loadFileTree: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const basePath = await getNotesBasePath();
      await ensureNotesFolder(basePath);
      
      const children = await buildFileTree(basePath);
      
      set({
        notesPath: basePath,
        rootFolder: {
          id: '',
          name: 'Notes',
          path: '',
          isFolder: true,
          children,
          expanded: true,
        },
        isLoading: false,
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load notes',
        isLoading: false,
      });
    }
  },

  openNote: async (path: string, openInNewTab: boolean = false) => {
    const { notesPath, isDirty, saveNote, recentNotes, openTabs, currentNote } = get();
    
    if (isDirty) {
      await saveNote();
    }
    
    try {
      const fullPath = await join(notesPath, path);
      const content = await readTextFile(fullPath);
      
      const h1Title = extractFirstH1(content);
      const tabName = h1Title || 'Untitled';
      const updatedRecent = addToRecentNotes(path, recentNotes);
      const existingTab = openTabs.find(t => t.path === path);
      
      let updatedTabs = openTabs;
      
      if (existingTab) {
        updatedTabs = openTabs.map(t => t.path === path ? { ...t, name: tabName } : t);
      } else if (openInNewTab || openTabs.length === 0) {
        updatedTabs = [...openTabs, { path, name: tabName, isDirty: false }];
      } else {
        const currentTabIndex = openTabs.findIndex(t => t.path === currentNote?.path);
        if (currentTabIndex !== -1) {
          updatedTabs = [...openTabs];
          updatedTabs[currentTabIndex] = { path, name: tabName, isDirty: false };
        } else {
          updatedTabs = [...openTabs, { path, name: tabName, isDirty: false }];
        }
      }
      
      updateDisplayName(set, path, tabName);
      
      set({
        currentNote: { path, content },
        isDirty: false,
        error: null,
        recentNotes: updatedRecent,
        openTabs: updatedTabs,
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to open note',
      });
    }
  },

  saveNote: async () => {
    const { currentNote, notesPath, openTabs, noteIcons, starredNotes } = get();
    if (!currentNote) return;
    
    try {
      const h1Title = extractFirstH1(currentNote.content);
      const currentFileName = currentNote.path.split('/').pop()?.replace('.md', '') || '';
      const dirPath = currentNote.path.includes('/') 
        ? currentNote.path.substring(0, currentNote.path.lastIndexOf('/')) 
        : '';
      
      if (h1Title && h1Title !== currentFileName) {
        const sanitizedTitle = sanitizeFileName(h1Title);
        const newFileName = `${sanitizedTitle}.md`;
        const newPath = dirPath ? `${dirPath}/${newFileName}` : newFileName;
        const newFullPath = await join(notesPath, newPath);
        const newFileExists = await exists(newFullPath);
        const oldFullPath = await join(notesPath, currentNote.path);
        
        if (!newFileExists || newFullPath === oldFullPath) {
          await writeTextFile(oldFullPath, currentNote.content);
          
          if (newPath !== currentNote.path) {
            await rename(oldFullPath, newFullPath);
            
            const icon = noteIcons.get(currentNote.path);
            if (icon) {
              const updatedIcons = new Map(noteIcons);
              updatedIcons.delete(currentNote.path);
              updatedIcons.set(newPath, icon);
              saveNoteIcons(updatedIcons);
              set({ noteIcons: updatedIcons });
            }
            
            if (starredNotes.includes(currentNote.path)) {
              const updatedStarred = starredNotes.map(p => 
                p === currentNote.path ? newPath : p
              );
              saveStarredNotes(updatedStarred);
              set({ starredNotes: updatedStarred });
            }
            
            const updatedTabs = openTabs.map(tab => 
              tab.path === currentNote.path 
                ? { ...tab, path: newPath, name: sanitizedTitle }
                : tab
            );
            
            moveDisplayNameInternal(set, currentNote.path, newPath);
            updateDisplayName(set, newPath, sanitizedTitle);
            
            const currentRootFolder = get().rootFolder;
            if (currentRootFolder) {
              set({
                rootFolder: {
                  ...currentRootFolder,
                  children: updateFileNodePath(currentRootFolder.children, currentNote.path, newPath, sanitizedTitle),
                },
              });
            }
            
            set({
              currentNote: { path: newPath, content: currentNote.content },
              isDirty: false,
              openTabs: updatedTabs,
            });
            
            return;
          }
        }
      }
      
      const fullPath = await join(notesPath, currentNote.path);
      await writeTextFile(fullPath, currentNote.content);
      
      set({ isDirty: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to save note',
      });
    }
  },

  createNote: async (folderPath?: string) => {
    let { notesPath, loadFileTree, openTabs, recentNotes, rootFolder } = get();
    
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    if (!notesPath) {
      notesPath = await getNotesBasePath();
      await ensureNotesFolder(notesPath);
      set({ notesPath });
    }
    
    try {
      let counter = 1;
      let fileName = 'Untitled.md';
      let relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;
      let fullPath = await join(notesPath, relativePath);
      
      while (await exists(fullPath)) {
        fileName = `Untitled ${counter}.md`;
        relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;
        fullPath = await join(notesPath, relativePath);
        counter++;
      }
      
      const defaultContent = '# ';
      await writeTextFile(fullPath, defaultContent);
      await loadFileTree();
      
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }
      
      const tabName = fileName.replace('.md', '');
      const updatedTabs = [...openTabs, { path: relativePath, name: tabName, isDirty: false }];
      const updatedRecent = addToRecentNotes(relativePath, recentNotes);
      
      set({
        currentNote: { path: relativePath, content: defaultContent },
        isDirty: false,
        openTabs: updatedTabs,
        recentNotes: updatedRecent,
      });
      
      return relativePath;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create note',
      });
      throw error;
    }
  },

  deleteNote: async (path: string) => {
    const { notesPath, currentNote, loadFileTree, rootFolder, openTabs } = get();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    try {
      const fullPath = await join(notesPath, path);
      await remove(fullPath);
      
      const updatedTabs = openTabs.filter(t => t.path !== path);
      removeDisplayNameInternal(set, path);
      
      if (currentNote?.path === path) {
        if (updatedTabs.length > 0) {
          const lastTab = updatedTabs[updatedTabs.length - 1];
          set({ openTabs: updatedTabs });
          await get().openNote(lastTab.path);
        } else {
          set({ currentNote: null, isDirty: false, openTabs: updatedTabs });
        }
      } else {
        set({ openTabs: updatedTabs });
      }
      
      // Reload file tree
      await loadFileTree();
      
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete note',
      });
    }
  },

  renameNote: async (path: string, newName: string) => {
    const { notesPath, currentNote, loadFileTree, rootFolder, openTabs } = get();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    try {
      const fullPath = await join(notesPath, path);
      const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
      const newFileName = newName.endsWith('.md') ? newName : `${newName}.md`;
      const newPath = dirPath ? `${dirPath}/${newFileName}` : newFileName;
      const newFullPath = await join(notesPath, newPath);
      
      await rename(fullPath, newFullPath);
      moveDisplayNameInternal(set, path, newPath);
      
      const updatedTabs = openTabs.map(tab => 
        tab.path === path ? { ...tab, path: newPath } : tab
      );
      
      if (currentNote?.path === path) {
        set({ 
          currentNote: { ...currentNote, path: newPath },
          openTabs: updatedTabs,
        });
      } else {
        set({ openTabs: updatedTabs });
      }
      
      await loadFileTree();
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to rename note',
      });
    }
  },

  createFolder: async (parentPath: string, name: string) => {
    const { notesPath, loadFileTree, rootFolder } = get();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    try {
      const folderPath = parentPath ? `${parentPath}/${name}` : name;
      const fullPath = await join(notesPath, folderPath);
      
      await mkdir(fullPath, { recursive: true });
      await loadFileTree();
      
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create folder',
      });
    }
  },

  deleteFolder: async (path: string) => {
    const { notesPath, loadFileTree, rootFolder } = get();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    try {
      const fullPath = await join(notesPath, path);
      await remove(fullPath, { recursive: true });
      await loadFileTree();
      
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete folder',
      });
    }
  },

  moveItem: async (sourcePath: string, targetFolderPath: string) => {
    const { notesPath, currentNote, loadFileTree, rootFolder, openTabs } = get();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    try {
      const fileName = sourcePath.split('/').pop() || '';
      const newPath = targetFolderPath ? `${targetFolderPath}/${fileName}` : fileName;
      const sourceFullPath = await join(notesPath, sourcePath);
      const targetFullPath = await join(notesPath, newPath);
      
      await rename(sourceFullPath, targetFullPath);
      moveDisplayNameInternal(set, sourcePath, newPath);
      
      const updatedTabs = openTabs.map(tab => 
        tab.path === sourcePath ? { ...tab, path: newPath } : tab
      );
      
      if (currentNote?.path === sourcePath) {
        set({ 
          currentNote: { ...currentNote, path: newPath },
          openTabs: updatedTabs,
        });
      } else {
        set({ openTabs: updatedTabs });
      }
      
      await loadFileTree();
      
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to move item',
      });
    }
  },

  toggleFolder: (path: string) => {
    const { rootFolder } = get();
    if (!rootFolder) return;
    
    set({
      rootFolder: {
        ...rootFolder,
        children: updateFolderExpanded(rootFolder.children, path),
      },
    });
  },

  updateContent: (content: string) => {
    const { currentNote } = get();
    if (!currentNote || currentNote.content === content) return;
    
    set({
      currentNote: { ...currentNote, content },
      isDirty: true,
    });
  },

  closeNote: () => {
    set({ currentNote: null, isDirty: false });
  },

  closeTab: async (path: string) => {
    const { openTabs, currentNote, isDirty, saveNote, notesPath, loadFileTree, rootFolder } = get();
    
    const isEmptyNote = currentNote?.path === path && 
      (!currentNote.content.trim() || currentNote.content.trim() === '#' || currentNote.content.trim() === '# ');
    
    if (isEmptyNote) {
      try {
        const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
        const fullPath = await join(notesPath, path);
        await remove(fullPath);
        removeDisplayNameInternal(set, path);
        await loadFileTree();
        
        const currentRootFolder = get().rootFolder;
        if (currentRootFolder) {
          set({
            rootFolder: {
              ...currentRootFolder,
              children: restoreExpandedState(currentRootFolder.children, expandedPaths),
            },
          });
        }
      } catch {
      }
    } else if (currentNote?.path === path && isDirty) {
      await saveNote();
    }
    
    const updatedTabs = openTabs.filter(t => t.path !== path);
    set({ openTabs: updatedTabs });
    
    if (currentNote?.path === path) {
      if (updatedTabs.length > 0) {
        const lastTab = updatedTabs[updatedTabs.length - 1];
        get().openNote(lastTab.path);
      } else {
        set({ currentNote: null, isDirty: false });
      }
    }
  },

  switchTab: (path: string) => {
    get().openNote(path);
  },

  reorderTabs: (fromIndex: number, toIndex: number) => {
    const { openTabs } = get();
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= openTabs.length) return;
    if (toIndex < 0 || toIndex >= openTabs.length) return;
    
    const updatedTabs = [...openTabs];
    const [movedTab] = updatedTabs.splice(fromIndex, 1);
    updatedTabs.splice(toIndex, 0, movedTab);
    
    set({ openTabs: updatedTabs });
  },

  createNoteWithContent: async (folderPath: string | undefined, name: string, content: string) => {
    let { notesPath, loadFileTree, rootFolder } = get();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    if (!notesPath) {
      notesPath = await getNotesBasePath();
      await ensureNotesFolder(notesPath);
      set({ notesPath });
    }
    
    try {
      const fileName = name.endsWith('.md') ? name : `${name}.md`;
      const relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;
      const fullPath = await join(notesPath, relativePath);
      
      if (folderPath) {
        const folderFullPath = await join(notesPath, folderPath);
        const folderExists = await exists(folderFullPath);
        if (!folderExists) {
          await mkdir(folderFullPath, { recursive: true });
        }
      }
      
      await writeTextFile(fullPath, content);
      await loadFileTree();
      
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }
      
      set({
        currentNote: { path: relativePath, content },
        isDirty: false,
      });
      
      return relativePath;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create note',
      });
      throw error;
    }
  },

  scanAllNotes: async () => {
    const { notesPath, rootFolder } = get();
    if (!rootFolder || !notesPath) return;

    const cache = new Map<string, string>();
    
    // Collect all file paths first
    const filePaths: { path: string; fullPath: string }[] = [];
    
    const collectPaths = async (nodes: FileTreeNode[]) => {
      for (const node of nodes) {
        if (node.isFolder) {
          await collectPaths(node.children);
        } else {
          const fullPath = await join(notesPath, node.path);
          filePaths.push({ path: node.path, fullPath });
        }
      }
    };
    
    await collectPaths(rootFolder.children);
    
    // Read files in parallel batches for better performance
    const BATCH_SIZE = 10;
    for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
      const batch = filePaths.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async ({ path, fullPath }) => {
          const content = await readTextFile(fullPath);
          return { path, content };
        })
      );
      
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          cache.set(result.value.path, result.value.content);
        }
      });
    }
    
    set({ noteContentsCache: cache });
  },

  getBacklinks: (notePath: string) => {
    const { noteContentsCache } = get();
    const results: { path: string; name: string; context: string }[] = [];
    const noteName = notePath.split('/').pop()?.replace('.md', '').toLowerCase() || '';
    
    // Pre-compile patterns once
    const patterns = [
      new RegExp(`\\[\\[${noteName}\\]\\]`, 'gi'),
      new RegExp(`\\[\\[${noteName}\\|[^\\]]+\\]\\]`, 'gi'),
    ];

    noteContentsCache.forEach((content, path) => {
      if (path === notePath) return;
      
      // Quick check before regex - skip if no [[ at all
      if (!content.includes('[[')) return;
      
      for (const pattern of patterns) {
        pattern.lastIndex = 0; // Reset regex state
        const match = pattern.exec(content);
        if (match) {
          const index = match.index;
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + match[0].length + 50);
          let context = content.substring(start, end).replace(/\n/g, ' ').trim();
          if (start > 0) context = '...' + context;
          if (end < content.length) context = context + '...';
          
          const fileName = path.split('/').pop()?.replace('.md', '') || path;
          results.push({ path, name: fileName, context });
          break;
        }
      }
    });

    return results;
  },

  getAllTags: () => {
    const { noteContentsCache } = get();
    const tagCounts = new Map<string, number>();
    const tagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;

    noteContentsCache.forEach((content) => {
      let match;
      while ((match = tagRegex.exec(content)) !== null) {
        const tag = match[1].toLowerCase();
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    });

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  },

  toggleStarred: (path: string) => {
    const { starredNotes } = get();
    const isCurrentlyStarred = starredNotes.includes(path);
    
    const updated = isCurrentlyStarred
      ? starredNotes.filter(p => p !== path)
      : [...starredNotes, path];
    
    saveStarredNotes(updated);
    set({ starredNotes: updated });
  },

  isStarred: (path: string) => {
    return get().starredNotes.includes(path);
  },

  getNoteIcon: (path: string) => {
    return get().noteIcons.get(path);
  },

  setNoteIcon: (path: string, emoji: string | null) => {
    const { noteIcons } = get();
    const updated = new Map(noteIcons);
    
    if (emoji) {
      updated.set(path, emoji);
    } else {
      updated.delete(path);
    }
    
    saveNoteIcons(updated);
    set({ noteIcons: updated });
  },

  syncDisplayName: (path: string, title: string) => {
    updateDisplayName(set, path, title);
  },

  getDisplayName: (path: string) => {
    const state = get();
    return state.displayNames.get(path) || path.split('/').pop()?.replace('.md', '') || 'Untitled';
  },
}));
