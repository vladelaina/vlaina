/**
 * Notes Store - State management for Markdown notes
 * 
 * Manages:
 * - File tree structure
 * - Current open note
 * - File operations (create, read, update, delete)
 */

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

// ============ Types ============

export interface NoteFile {
  id: string;           // Unique identifier (path-based)
  name: string;         // File name without extension
  path: string;         // Full path relative to notes folder
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
  // State
  rootFolder: FolderNode | null;
  currentNote: { path: string; content: string } | null;
  notesPath: string;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  recentNotes: string[]; // Recently opened note paths
  openTabs: { path: string; name: string; isDirty: boolean }[]; // Open tabs
  noteContentsCache: Map<string, string>; // Cache for backlinks/search
  starredNotes: string[]; // Starred/bookmarked note paths
  // UI State
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  showOutline: boolean;
  showBacklinks: boolean;
  showAIPanel: boolean;
}

interface NotesActions {
  // Actions
  loadFileTree: () => Promise<void>;
  openNote: (path: string) => Promise<void>;
  saveNote: () => Promise<void>;
  createNote: (folderPath?: string) => Promise<string>;
  createNoteWithContent: (folderPath: string | undefined, name: string, content: string) => Promise<string>;
  deleteNote: (path: string) => Promise<void>;
  renameNote: (path: string, newName: string) => Promise<void>;
  createFolder: (parentPath: string, name: string) => Promise<void>;
  deleteFolder: (path: string) => Promise<void>;
  moveItem: (sourcePath: string, targetFolderPath: string) => Promise<void>;
  toggleFolder: (path: string) => void;
  updateContent: (content: string) => void;
  closeNote: () => void;
  closeTab: (path: string) => void;
  switchTab: (path: string) => void;
  scanAllNotes: () => Promise<void>;
  getBacklinks: (notePath: string) => { path: string; name: string; context: string }[];
  getAllTags: () => { tag: string; count: number }[];
  toggleStarred: (path: string) => void;
  isStarred: (path: string) => boolean;
  // UI Actions
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setShowOutline: (show: boolean) => void;
  setShowBacklinks: (show: boolean) => void;
  toggleAIPanel: () => void;
}

type NotesStore = NotesState & NotesActions;

// ============ Helpers ============

const DEFAULT_NOTES_FOLDER = 'NekoTick/notes';
const RECENT_NOTES_KEY = 'nekotick-recent-notes';
const STARRED_NOTES_KEY = 'nekotick-starred-notes';
const MAX_RECENT_NOTES = 10;

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
  
  // Sort: folders first, then alphabetically
  return sortFileTree(nodes);
}

export function sortFileTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return [...nodes].sort((a, b) => {
    // Folders come first
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    // Then alphabetically (case-insensitive)
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
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

// ============ Store ============

export const useNotesStore = create<NotesStore>()((set, get) => ({
  // Initial state
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
  // UI State
  sidebarCollapsed: false,
  rightPanelCollapsed: true,
  showOutline: false,
  showBacklinks: false,
  showAIPanel: false,

  // Load file tree from disk
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

  // Open a note for editing
  openNote: async (path: string) => {
    const { notesPath, isDirty, saveNote, recentNotes, openTabs } = get();
    
    // Auto-save current note if dirty
    if (isDirty) {
      await saveNote();
    }
    
    try {
      const fullPath = await join(notesPath, path);
      const content = await readTextFile(fullPath);
      
      // Add to recent notes
      const updatedRecent = addToRecentNotes(path, recentNotes);
      
      // Add to open tabs if not already open
      const fileName = path.split('/').pop()?.replace('.md', '') || 'Untitled';
      const existingTab = openTabs.find(t => t.path === path);
      const updatedTabs = existingTab 
        ? openTabs 
        : [...openTabs, { path, name: fileName, isDirty: false }];
      
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

  // Save current note to disk
  saveNote: async () => {
    const { currentNote, notesPath } = get();
    if (!currentNote) return;
    
    try {
      const fullPath = await join(notesPath, currentNote.path);
      await writeTextFile(fullPath, currentNote.content);
      set({ isDirty: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to save note',
      });
    }
  },

  // Create a new note
  createNote: async (folderPath?: string) => {
    let { notesPath, loadFileTree } = get();
    
    // Ensure notesPath is set
    if (!notesPath) {
      notesPath = await getNotesBasePath();
      await ensureNotesFolder(notesPath);
      set({ notesPath });
    }
    
    try {
      // Generate unique name
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
      
      // Create empty file
      await writeTextFile(fullPath, '');
      
      // Reload file tree
      await loadFileTree();
      
      // Open the new note
      set({
        currentNote: { path: relativePath, content: '' },
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

  // Delete a note
  deleteNote: async (path: string) => {
    const { notesPath, currentNote, loadFileTree } = get();
    
    try {
      const fullPath = await join(notesPath, path);
      await remove(fullPath);
      
      // Close if current note was deleted
      if (currentNote?.path === path) {
        set({ currentNote: null, isDirty: false });
      }
      
      // Reload file tree
      await loadFileTree();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete note',
      });
    }
  },

  // Rename a note
  renameNote: async (path: string, newName: string) => {
    const { notesPath, currentNote, loadFileTree } = get();
    
    try {
      const fullPath = await join(notesPath, path);
      const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
      const newFileName = newName.endsWith('.md') ? newName : `${newName}.md`;
      const newPath = dirPath ? `${dirPath}/${newFileName}` : newFileName;
      const newFullPath = await join(notesPath, newPath);
      
      await rename(fullPath, newFullPath);
      
      // Update current note path if renamed
      if (currentNote?.path === path) {
        set({ currentNote: { ...currentNote, path: newPath } });
      }
      
      // Reload file tree
      await loadFileTree();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to rename note',
      });
    }
  },

  // Create a new folder
  createFolder: async (parentPath: string, name: string) => {
    const { notesPath, loadFileTree } = get();
    
    try {
      const folderPath = parentPath ? `${parentPath}/${name}` : name;
      const fullPath = await join(notesPath, folderPath);
      
      await mkdir(fullPath, { recursive: true });
      
      // Reload file tree
      await loadFileTree();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create folder',
      });
    }
  },

  // Delete a folder
  deleteFolder: async (path: string) => {
    const { notesPath, loadFileTree } = get();
    
    try {
      const fullPath = await join(notesPath, path);
      await remove(fullPath, { recursive: true });
      
      // Reload file tree
      await loadFileTree();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete folder',
      });
    }
  },

  // Move item (file or folder) to a new location
  moveItem: async (sourcePath: string, targetFolderPath: string) => {
    const { notesPath, currentNote, loadFileTree } = get();
    
    try {
      const fileName = sourcePath.split('/').pop() || '';
      const newPath = targetFolderPath ? `${targetFolderPath}/${fileName}` : fileName;
      const sourceFullPath = await join(notesPath, sourcePath);
      const targetFullPath = await join(notesPath, newPath);
      
      await rename(sourceFullPath, targetFullPath);
      
      // Update current note path if moved
      if (currentNote?.path === sourcePath) {
        set({ currentNote: { ...currentNote, path: newPath } });
      }
      
      // Reload file tree
      await loadFileTree();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to move item',
      });
    }
  },

  // Toggle folder expanded state
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

  // Update note content (marks as dirty)
  updateContent: (content: string) => {
    const { currentNote } = get();
    if (!currentNote) return;
    
    set({
      currentNote: { ...currentNote, content },
      isDirty: true,
    });
  },

  // Close current note
  closeNote: () => {
    set({ currentNote: null, isDirty: false });
  },

  // Close a specific tab
  closeTab: (path: string) => {
    const { openTabs, currentNote, isDirty, saveNote } = get();
    
    // Save if closing current dirty note
    if (currentNote?.path === path && isDirty) {
      saveNote();
    }
    
    const updatedTabs = openTabs.filter(t => t.path !== path);
    
    // If closing current tab, switch to another
    if (currentNote?.path === path) {
      if (updatedTabs.length > 0) {
        const lastTab = updatedTabs[updatedTabs.length - 1];
        get().openNote(lastTab.path);
      } else {
        set({ currentNote: null, isDirty: false });
      }
    }
    
    set({ openTabs: updatedTabs });
  },

  // Switch to a tab
  switchTab: (path: string) => {
    get().openNote(path);
  },

  // Create note with specific content (for templates/daily notes)
  createNoteWithContent: async (folderPath: string | undefined, name: string, content: string) => {
    let { notesPath, loadFileTree } = get();
    
    // Ensure notesPath is set
    if (!notesPath) {
      notesPath = await getNotesBasePath();
      await ensureNotesFolder(notesPath);
      set({ notesPath });
    }
    
    try {
      const fileName = name.endsWith('.md') ? name : `${name}.md`;
      const relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;
      const fullPath = await join(notesPath, relativePath);
      
      // Ensure folder exists
      if (folderPath) {
        const folderFullPath = await join(notesPath, folderPath);
        const folderExists = await exists(folderFullPath);
        if (!folderExists) {
          await mkdir(folderFullPath, { recursive: true });
        }
      }
      
      // Create file with content
      await writeTextFile(fullPath, content);
      
      // Reload file tree
      await loadFileTree();
      
      // Open the new note
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

  // Scan all notes and cache their contents for backlinks/tags
  scanAllNotes: async () => {
    const { notesPath, rootFolder } = get();
    if (!rootFolder || !notesPath) return;

    const cache = new Map<string, string>();
    
    const scanFolder = async (nodes: FileTreeNode[]) => {
      for (const node of nodes) {
        if (node.isFolder) {
          await scanFolder(node.children);
        } else {
          try {
            const fullPath = await join(notesPath, node.path);
            const content = await readTextFile(fullPath);
            cache.set(node.path, content);
          } catch {
            // Skip files that can't be read
          }
        }
      }
    };

    await scanFolder(rootFolder.children);
    set({ noteContentsCache: cache });
  },

  // Get backlinks for a note
  getBacklinks: (notePath: string) => {
    const { noteContentsCache } = get();
    const results: { path: string; name: string; context: string }[] = [];
    
    // Get the note name without extension and path
    const noteName = notePath.split('/').pop()?.replace('.md', '').toLowerCase() || '';
    
    // Wiki link patterns to match
    const patterns = [
      new RegExp(`\\[\\[${noteName}\\]\\]`, 'gi'),
      new RegExp(`\\[\\[${noteName}\\|[^\\]]+\\]\\]`, 'gi'),
    ];

    noteContentsCache.forEach((content, path) => {
      if (path === notePath) return; // Skip self
      
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          // Find context around the match
          const index = content.search(pattern);
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + match[0].length + 50);
          let context = content.substring(start, end).replace(/\n/g, ' ').trim();
          if (start > 0) context = '...' + context;
          if (end < content.length) context = context + '...';
          
          const fileName = path.split('/').pop()?.replace('.md', '') || path;
          results.push({ path, name: fileName, context });
          break; // Only add once per file
        }
      }
    });

    return results;
  },

  // Get all tags from all notes
  getAllTags: () => {
    const { noteContentsCache } = get();
    const tagCounts = new Map<string, number>();
    
    // Regex to match #tag (not inside code blocks)
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

  // Toggle starred status for a note
  toggleStarred: (path: string) => {
    const { starredNotes } = get();
    const isCurrentlyStarred = starredNotes.includes(path);
    
    const updated = isCurrentlyStarred
      ? starredNotes.filter(p => p !== path)
      : [...starredNotes, path];
    
    saveStarredNotes(updated);
    set({ starredNotes: updated });
  },

  // Check if a note is starred
  isStarred: (path: string) => {
    return get().starredNotes.includes(path);
  },

  // UI Actions
  toggleSidebar: () => {
    set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  toggleRightPanel: () => {
    const { rightPanelCollapsed, showOutline, showBacklinks } = get();
    if (rightPanelCollapsed) {
      // Opening: if nothing is shown, show outline by default
      set({ 
        rightPanelCollapsed: false,
        showOutline: !showOutline && !showBacklinks ? true : showOutline,
      });
    } else {
      set({ rightPanelCollapsed: true });
    }
  },

  setShowOutline: (show: boolean) => {
    set({ showOutline: show, rightPanelCollapsed: show ? false : get().rightPanelCollapsed });
  },

  setShowBacklinks: (show: boolean) => {
    set({ showBacklinks: show, rightPanelCollapsed: show ? false : get().rightPanelCollapsed });
  },

  toggleAIPanel: () => {
    set(state => ({ showAIPanel: !state.showAIPanel }));
  },
}));
