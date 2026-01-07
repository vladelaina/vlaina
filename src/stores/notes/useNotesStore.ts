/** Notes Store - Markdown notes state management */

import { create } from 'zustand';
import { readTextFile, writeTextFile, mkdir, remove, rename, exists } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

// Types
import type { NotesStore, FileTreeNode } from './types';

// Utils
import { buildFileTree, sortFileTree, updateFileNodePath, updateFolderExpanded, collectExpandedPaths, restoreExpandedState } from './fileTreeUtils';
import { extractFirstH1, sanitizeFileName } from './noteUtils';
import { updateDisplayName, removeDisplayName, moveDisplayName } from './displayNameUtils';
import { loadRecentNotes, addToRecentNotes, loadStarredNotes, saveStarredNotes, loadNoteIconsFromFile, saveNoteIconsToFile, getNotesBasePath, ensureNotesFolder, setCurrentVaultPath as setVaultPath, getCurrentVaultPath as getVaultPath } from './storage';

// Re-export for external use
export * from './types';
export { sortFileTree } from './fileTreeUtils';
export const setCurrentVaultPath = setVaultPath;
export const getCurrentVaultPath = getVaultPath;

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
  noteIcons: new Map(),
  displayNames: new Map(),
  isNewlyCreated: false,
  newlyCreatedFolderPath: null,

  loadFileTree: async () => {
    set({ isLoading: true, error: null });
    try {
      const basePath = await getNotesBasePath();
      await ensureNotesFolder(basePath);
      const children = await buildFileTree(basePath);
      const icons = await loadNoteIconsFromFile(basePath);
      set({
        notesPath: basePath,
        rootFolder: { id: '', name: 'Notes', path: '', isFolder: true, children, expanded: true },
        noteIcons: icons,
        isLoading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load notes', isLoading: false });
    }
  },

  toggleFolder: (path: string) => {
    const { rootFolder } = get();
    if (!rootFolder) return;
    set({ rootFolder: { ...rootFolder, children: updateFolderExpanded(rootFolder.children, path) } });
  },

  openNote: async (path: string, openInNewTab: boolean = false) => {
    const { notesPath, isDirty, saveNote, recentNotes, openTabs, currentNote } = get();
    if (isDirty) await saveNote();
    
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
      set({ currentNote: { path, content }, isDirty: false, error: null, recentNotes: updatedRecent, openTabs: updatedTabs, isNewlyCreated: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open note' });
    }
  },

  saveNote: async () => {
    const { currentNote, notesPath, openTabs, noteIcons, starredNotes } = get();
    if (!currentNote) return;
    
    try {
      const h1Title = extractFirstH1(currentNote.content);
      const currentFileName = currentNote.path.split('/').pop()?.replace('.md', '') || '';
      const dirPath = currentNote.path.includes('/') ? currentNote.path.substring(0, currentNote.path.lastIndexOf('/')) : '';
      
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
              saveNoteIconsToFile(notesPath, updatedIcons);
              set({ noteIcons: updatedIcons });
            }
            
            if (starredNotes.includes(currentNote.path)) {
              const updatedStarred = starredNotes.map(p => p === currentNote.path ? newPath : p);
              saveStarredNotes(updatedStarred);
              set({ starredNotes: updatedStarred });
            }
            
            const updatedTabs = openTabs.map(tab => tab.path === currentNote.path ? { ...tab, path: newPath, name: sanitizedTitle } : tab);
            moveDisplayName(set, currentNote.path, newPath);
            updateDisplayName(set, newPath, sanitizedTitle);
            
            const currentRootFolder = get().rootFolder;
            if (currentRootFolder) {
              set({ rootFolder: { ...currentRootFolder, children: updateFileNodePath(currentRootFolder.children, currentNote.path, newPath, sanitizedTitle) } });
            }
            
            set({ currentNote: { path: newPath, content: currentNote.content }, isDirty: false, openTabs: updatedTabs });
            return;
          }
        }
      }
      
      const fullPath = await join(notesPath, currentNote.path);
      await writeTextFile(fullPath, currentNote.content);
      set({ isDirty: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save note' });
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
        set({ rootFolder: { ...currentRootFolder, children: restoreExpandedState(currentRootFolder.children, expandedPaths) } });
      }
      
      const tabName = fileName.replace('.md', '');
      const updatedTabs = [...openTabs, { path: relativePath, name: tabName, isDirty: false }];
      const updatedRecent = addToRecentNotes(relativePath, recentNotes);
      
      set({ currentNote: { path: relativePath, content: defaultContent }, isDirty: false, openTabs: updatedTabs, recentNotes: updatedRecent, isNewlyCreated: true });
      return relativePath;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create note' });
      throw error;
    }
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
        if (!folderExists) await mkdir(folderFullPath, { recursive: true });
      }
      
      await writeTextFile(fullPath, content);
      await loadFileTree();
      
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({ rootFolder: { ...currentRootFolder, children: restoreExpandedState(currentRootFolder.children, expandedPaths) } });
      }
      
      set({ currentNote: { path: relativePath, content }, isDirty: false });
      return relativePath;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create note' });
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
      removeDisplayName(set, path);
      
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
      
      await loadFileTree();
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({ rootFolder: { ...currentRootFolder, children: restoreExpandedState(currentRootFolder.children, expandedPaths) } });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete note' });
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
      moveDisplayName(set, path, newPath);
      
      const updatedTabs = openTabs.map(tab => tab.path === path ? { ...tab, path: newPath } : tab);
      
      if (currentNote?.path === path) {
        set({ currentNote: { ...currentNote, path: newPath }, openTabs: updatedTabs });
      } else {
        set({ openTabs: updatedTabs });
      }
      
      await loadFileTree();
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({ rootFolder: { ...currentRootFolder, children: restoreExpandedState(currentRootFolder.children, expandedPaths) } });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to rename note' });
    }
  },

  renameFolder: async (path: string, newName: string) => {
    const { notesPath, rootFolder, currentNote, openTabs } = get();
    
    try {
      const fullPath = await join(notesPath, path);
      const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
      const newPath = dirPath ? `${dirPath}/${newName}` : newName;
      const newFullPath = await join(notesPath, newPath);
      
      await rename(fullPath, newFullPath);
      
      const updateFolderNode = (nodes: FileTreeNode[], targetPath: string, newName: string, newPath: string): FileTreeNode[] => {
        return nodes.map(node => {
          if (node.path === targetPath && node.isFolder) {
            const updateChildPaths = (children: FileTreeNode[], oldBasePath: string, newBasePath: string): FileTreeNode[] => {
              return children.map(child => {
                const newChildPath = child.path.replace(oldBasePath, newBasePath);
                if (child.isFolder) {
                  return { ...child, id: newChildPath, path: newChildPath, children: updateChildPaths(child.children, oldBasePath, newBasePath) };
                }
                return { ...child, id: newChildPath, path: newChildPath };
              });
            };
            return { ...node, id: newPath, name: newName, path: newPath, children: updateChildPaths(node.children, targetPath, newPath) };
          }
          if (node.isFolder) {
            return { ...node, children: updateFolderNode(node.children, targetPath, newName, newPath) };
          }
          return node;
        });
      };
      
      const updatedTabs = openTabs.map(tab => {
        if (tab.path.startsWith(path + '/')) {
          const newTabPath = tab.path.replace(path, newPath);
          moveDisplayName(set, tab.path, newTabPath);
          return { ...tab, path: newTabPath };
        }
        return tab;
      });
      
      let updatedCurrentNote = currentNote;
      if (currentNote && currentNote.path.startsWith(path + '/')) {
        const newNotePath = currentNote.path.replace(path, newPath);
        moveDisplayName(set, currentNote.path, newNotePath);
        updatedCurrentNote = { ...currentNote, path: newNotePath };
      }
      
      if (rootFolder) {
        const updatedChildren = updateFolderNode(rootFolder.children, path, newName, newPath);
        set({ rootFolder: { ...rootFolder, children: sortFileTree(updatedChildren) }, openTabs: updatedTabs, currentNote: updatedCurrentNote });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to rename folder' });
    }
  },

  createFolder: async (parentPath: string, name?: string) => {
    const { notesPath, loadFileTree, rootFolder } = get();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    try {
      let folderName = name || 'Untitled';
      let folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
      let fullPath = await join(notesPath, folderPath);
      
      if (!name) {
        let counter = 1;
        while (await exists(fullPath)) {
          folderName = `Untitled ${counter}`;
          folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
          fullPath = await join(notesPath, folderPath);
          counter++;
        }
      }
      
      await mkdir(fullPath, { recursive: true });
      if (parentPath) expandedPaths.add(parentPath);
      
      await loadFileTree();
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({ rootFolder: { ...currentRootFolder, children: restoreExpandedState(currentRootFolder.children, expandedPaths) }, newlyCreatedFolderPath: !name ? folderPath : null });
      }
      return folderPath;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create folder' });
      return null;
    }
  },

  clearNewlyCreatedFolder: () => set({ newlyCreatedFolderPath: null }),

  deleteFolder: async (path: string) => {
    const { notesPath, loadFileTree, rootFolder } = get();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    try {
      const fullPath = await join(notesPath, path);
      await remove(fullPath, { recursive: true });
      await loadFileTree();
      
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({ rootFolder: { ...currentRootFolder, children: restoreExpandedState(currentRootFolder.children, expandedPaths) } });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete folder' });
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
      moveDisplayName(set, sourcePath, newPath);
      
      const updatedTabs = openTabs.map(tab => tab.path === sourcePath ? { ...tab, path: newPath } : tab);
      
      if (currentNote?.path === sourcePath) {
        set({ currentNote: { ...currentNote, path: newPath }, openTabs: updatedTabs });
      } else {
        set({ openTabs: updatedTabs });
      }
      
      await loadFileTree();
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({ rootFolder: { ...currentRootFolder, children: restoreExpandedState(currentRootFolder.children, expandedPaths) } });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to move item' });
    }
  },

  updateContent: (content: string) => {
    const { currentNote } = get();
    if (!currentNote || currentNote.content === content) return;
    set({ currentNote: { ...currentNote, content }, isDirty: true });
  },

  closeNote: () => set({ currentNote: null, isDirty: false }),

  closeTab: async (path: string) => {
    const { openTabs, currentNote, isDirty, saveNote, notesPath, loadFileTree, rootFolder } = get();
    
    const isEmptyNote = currentNote?.path === path && (!currentNote.content.trim() || currentNote.content.trim() === '#' || currentNote.content.trim() === '# ');
    
    if (isEmptyNote) {
      try {
        const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
        const fullPath = await join(notesPath, path);
        await remove(fullPath);
        removeDisplayName(set, path);
        await loadFileTree();
        
        const currentRootFolder = get().rootFolder;
        if (currentRootFolder) {
          set({ rootFolder: { ...currentRootFolder, children: restoreExpandedState(currentRootFolder.children, expandedPaths) } });
        }
      } catch { /* ignore */ }
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

  switchTab: (path: string) => get().openNote(path),

  reorderTabs: (fromIndex: number, toIndex: number) => {
    const { openTabs } = get();
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= openTabs.length || toIndex < 0 || toIndex >= openTabs.length) return;
    
    const updatedTabs = [...openTabs];
    const [movedTab] = updatedTabs.splice(fromIndex, 1);
    updatedTabs.splice(toIndex, 0, movedTab);
    set({ openTabs: updatedTabs });
  },

  scanAllNotes: async () => {
    const { notesPath, rootFolder } = get();
    if (!rootFolder || !notesPath) return;

    const cache = new Map<string, string>();
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
    
    const BATCH_SIZE = 10;
    for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
      const batch = filePaths.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(async ({ path, fullPath }) => {
        const content = await readTextFile(fullPath);
        return { path, content };
      }));
      
      results.forEach((result) => {
        if (result.status === 'fulfilled') cache.set(result.value.path, result.value.content);
      });
    }
    
    set({ noteContentsCache: cache });
  },

  getBacklinks: (notePath: string) => {
    const { noteContentsCache } = get();
    const results: { path: string; name: string; context: string }[] = [];
    const noteName = notePath.split('/').pop()?.replace('.md', '').toLowerCase() || '';
    
    const patterns = [
      new RegExp(`\\[\\[${noteName}\\]\\]`, 'gi'),
      new RegExp(`\\[\\[${noteName}\\|[^\\]]+\\]\\]`, 'gi'),
    ];

    noteContentsCache.forEach((content, path) => {
      if (path === notePath || !content.includes('[[')) return;
      
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
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

    return Array.from(tagCounts.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  },

  toggleStarred: (path: string) => {
    const { starredNotes } = get();
    const isCurrentlyStarred = starredNotes.includes(path);
    const updated = isCurrentlyStarred ? starredNotes.filter(p => p !== path) : [...starredNotes, path];
    saveStarredNotes(updated);
    set({ starredNotes: updated });
  },

  isStarred: (path: string) => get().starredNotes.includes(path),

  getNoteIcon: (path: string) => get().noteIcons.get(path),

  setNoteIcon: (path: string, emoji: string | null) => {
    const { noteIcons, notesPath } = get();
    const updated = new Map(noteIcons);
    if (emoji) updated.set(path, emoji);
    else updated.delete(path);
    if (notesPath) saveNoteIconsToFile(notesPath, updated);
    set({ noteIcons: updated });
  },

  syncDisplayName: (path: string, title: string) => updateDisplayName(set, path, title),

  getDisplayName: (path: string) => {
    const state = get();
    return state.displayNames.get(path) || path.split('/').pop()?.replace('.md', '') || 'Untitled';
  },
}));
