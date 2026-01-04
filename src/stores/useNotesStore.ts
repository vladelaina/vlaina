/**
 * Notes Store - State management for Markdown notes
 * 
 * Architecture (aligned with Calendar/Unified pattern):
 * - Data state: File tree, notes content, icons, starred, etc.
 * - UI state: Delegated to useUIStore (sidebar, AI panel, preview icon)
 * - Display names: Managed internally with syncDisplayName action
 * 
 * Manages:
 * - File tree structure
 * - Current open note
 * - File operations (create, read, update, delete)
 * - Display names (from H1 titles, for real-time UI updates)
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
  // Data State
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
  noteIcons: Map<string, string>; // Note path -> emoji icon mapping
  displayNames: Map<string, string>; // Note path -> display name (from H1 title)
}

interface NotesActions {
  // File Tree Actions
  loadFileTree: () => Promise<void>;
  toggleFolder: (path: string) => void;
  
  // Note CRUD Actions
  openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
  saveNote: () => Promise<void>;
  createNote: (folderPath?: string) => Promise<string>;
  createNoteWithContent: (folderPath: string | undefined, name: string, content: string) => Promise<string>;
  deleteNote: (path: string) => Promise<void>;
  renameNote: (path: string, newName: string) => Promise<void>;
  
  // Folder Actions
  createFolder: (parentPath: string, name: string) => Promise<void>;
  deleteFolder: (path: string) => Promise<void>;
  moveItem: (sourcePath: string, targetFolderPath: string) => Promise<void>;
  
  // Content Actions
  updateContent: (content: string) => void;
  closeNote: () => void;
  
  // Tab Actions
  closeTab: (path: string) => Promise<void>;
  switchTab: (path: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  
  // Search/Backlinks Actions
  scanAllNotes: () => Promise<void>;
  getBacklinks: (notePath: string) => { path: string; name: string; context: string }[];
  getAllTags: () => { tag: string; count: number }[];
  
  // Starred Actions
  toggleStarred: (path: string) => void;
  isStarred: (path: string) => boolean;
  
  // Icon Actions
  getNoteIcon: (path: string) => string | undefined;
  setNoteIcon: (path: string, emoji: string | null) => void;
  
  // Display Name Actions (internal, called by editor plugin)
  syncDisplayName: (path: string, title: string) => void;
  getDisplayName: (path: string) => string;
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

// Update a single file node's path and name in the tree (for rename without full reload)
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

// 收集所有展开的文件夹路径
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

// 恢复文件夹展开状态
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

// 从 Markdown 内容中提取第一个一级标题（必须在文件开头）
function extractFirstH1(content: string): string | null {
  // 获取第一行
  const firstLineEnd = content.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? content : content.substring(0, firstLineEnd);
  
  // 检查第一行是否是 H1 标题格式
  const match = firstLine.match(/^#\s+(.+)$/);
  if (match && match[1]) {
    let title = match[1].trim();
    // 排除 placeholder 文字
    if (title === 'Title' || title === '') {
      return null;
    }
    // 移除 Windows/Unix 文件名中不允许的字符
    title = title.replace(/[<>:"/\\|?*]/g, '');
    title = title.trim();
    return title || null;
  }
  return null;
}

// 清理文件名，确保合法
function sanitizeFileName(name: string): string {
  // 移除不允许的字符
  let sanitized = name.replace(/[<>:"/\\|?*]/g, '');
  // 移除首尾空格和点
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
  // 如果为空，返回默认名称
  return sanitized || 'Untitled';
}

// ============ Display Name Helpers ============

// Internal: Update display name for a path
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

// Internal: Remove display name for a path
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

// Internal: Move display name from old path to new path
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

// ============ Store ============

export const useNotesStore = create<NotesStore>()((set, get) => ({
  // Initial state (Data only, UI state moved to useUIStore)
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
  openNote: async (path: string, openInNewTab: boolean = false) => {
    const { notesPath, isDirty, saveNote, recentNotes, openTabs, currentNote } = get();
    
    // Auto-save current note if dirty
    if (isDirty) {
      await saveNote();
    }
    
    try {
      const fullPath = await join(notesPath, path);
      const content = await readTextFile(fullPath);
      
      // 从内容中提取标题，如果没有则使用 Untitled
      const h1Title = extractFirstH1(content);
      const tabName = h1Title || 'Untitled';
      
      // Add to recent notes
      const updatedRecent = addToRecentNotes(path, recentNotes);
      
      // Check if already open in a tab
      const existingTab = openTabs.find(t => t.path === path);
      
      let updatedTabs = openTabs;
      
      if (existingTab) {
        // Already open, update name from content
        updatedTabs = openTabs.map(t => t.path === path ? { ...t, name: tabName } : t);
      } else if (openInNewTab || openTabs.length === 0) {
        // Open in new tab (Ctrl+click or no tabs open)
        updatedTabs = [...openTabs, { path, name: tabName, isDirty: false }];
      } else {
        // Replace current tab
        const currentTabIndex = openTabs.findIndex(t => t.path === currentNote?.path);
        if (currentTabIndex !== -1) {
          updatedTabs = [...openTabs];
          updatedTabs[currentTabIndex] = { path, name: tabName, isDirty: false };
        } else {
          // No current tab found, add as new
          updatedTabs = [...openTabs, { path, name: tabName, isDirty: false }];
        }
      }
      
      // 更新 displayNames (内部方法)
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

  // Save current note to disk
  saveNote: async () => {
    const { currentNote, notesPath, openTabs, noteIcons, starredNotes } = get();
    if (!currentNote) return;
    
    try {
      // 提取一级标题
      const h1Title = extractFirstH1(currentNote.content);
      const currentFileName = currentNote.path.split('/').pop()?.replace('.md', '') || '';
      const dirPath = currentNote.path.includes('/') 
        ? currentNote.path.substring(0, currentNote.path.lastIndexOf('/')) 
        : '';
      
      // 如果有一级标题且与当前文件名不同，则重命名文件
      if (h1Title && h1Title !== currentFileName) {
        const sanitizedTitle = sanitizeFileName(h1Title);
        const newFileName = `${sanitizedTitle}.md`;
        const newPath = dirPath ? `${dirPath}/${newFileName}` : newFileName;
        const newFullPath = await join(notesPath, newPath);
        
        // 检查新文件名是否已存在（排除当前文件）
        const newFileExists = await exists(newFullPath);
        const oldFullPath = await join(notesPath, currentNote.path);
        
        if (!newFileExists || newFullPath === oldFullPath) {
          // 先保存内容到当前文件
          await writeTextFile(oldFullPath, currentNote.content);
          
          // 如果文件名需要改变
          if (newPath !== currentNote.path) {
            // 重命名文件
            await rename(oldFullPath, newFullPath);
            
            // 更新图标映射（如果有）
            const icon = noteIcons.get(currentNote.path);
            if (icon) {
              const updatedIcons = new Map(noteIcons);
              updatedIcons.delete(currentNote.path);
              updatedIcons.set(newPath, icon);
              saveNoteIcons(updatedIcons);
              set({ noteIcons: updatedIcons });
            }
            
            // 更新收藏状态（如果有）
            if (starredNotes.includes(currentNote.path)) {
              const updatedStarred = starredNotes.map(p => 
                p === currentNote.path ? newPath : p
              );
              saveStarredNotes(updatedStarred);
              set({ starredNotes: updatedStarred });
            }
            
            // 更新标签页
            const updatedTabs = openTabs.map(tab => 
              tab.path === currentNote.path 
                ? { ...tab, path: newPath, name: sanitizedTitle }
                : tab
            );
            
            // 更新显示名称 (内部方法)
            moveDisplayNameInternal(set, currentNote.path, newPath);
            updateDisplayName(set, newPath, sanitizedTitle);
            
            // 更新文件树中的节点（局部更新，不重新加载）
            const currentRootFolder = get().rootFolder;
            if (currentRootFolder) {
              set({
                rootFolder: {
                  ...currentRootFolder,
                  children: updateFileNodePath(currentRootFolder.children, currentNote.path, newPath, sanitizedTitle),
                },
              });
            }
            
            // 更新当前笔记路径
            set({
              currentNote: { path: newPath, content: currentNote.content },
              isDirty: false,
              openTabs: updatedTabs,
            });
            
            return;
          }
        }
      }
      
      // 普通保存（没有标题变化或无法重命名）
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
    let { notesPath, loadFileTree, openTabs, recentNotes, rootFolder } = get();
    
    // 保存当前展开的文件夹路径
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
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
      
      // Create file with default H1 heading
      const defaultContent = '# ';
      await writeTextFile(fullPath, defaultContent);
      
      // Reload file tree
      await loadFileTree();
      
      // 恢复文件夹展开状态
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }
      
      // Add to open tabs
      const tabName = fileName.replace('.md', '');
      const updatedTabs = [...openTabs, { path: relativePath, name: tabName, isDirty: false }];
      
      // Add to recent notes
      const updatedRecent = addToRecentNotes(relativePath, recentNotes);
      
      // Open the new note with default H1 content
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

  // Delete a note
  deleteNote: async (path: string) => {
    const { notesPath, currentNote, loadFileTree, rootFolder, openTabs } = get();
    
    // 保存当前展开的文件夹路径
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    try {
      const fullPath = await join(notesPath, path);
      await remove(fullPath);
      
      // 从打开的标签中移除被删除的笔记
      const updatedTabs = openTabs.filter(t => t.path !== path);
      
      // 清理 displayNames (内部方法)
      removeDisplayNameInternal(set, path);
      
      // Close if current note was deleted, switch to another tab
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
      
      // 恢复文件夹展开状态
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

  // Rename a note
  renameNote: async (path: string, newName: string) => {
    const { notesPath, currentNote, loadFileTree, rootFolder, openTabs } = get();
    
    // 保存当前展开的文件夹路径
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    try {
      const fullPath = await join(notesPath, path);
      const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
      const newFileName = newName.endsWith('.md') ? newName : `${newName}.md`;
      const newPath = dirPath ? `${dirPath}/${newFileName}` : newFileName;
      const newFullPath = await join(notesPath, newPath);
      
      await rename(fullPath, newFullPath);
      
      // 更新 displayNames (内部方法)
      moveDisplayNameInternal(set, path, newPath);
      
      // 更新 openTabs
      const updatedTabs = openTabs.map(tab => 
        tab.path === path ? { ...tab, path: newPath } : tab
      );
      
      // Update current note path if renamed
      if (currentNote?.path === path) {
        set({ 
          currentNote: { ...currentNote, path: newPath },
          openTabs: updatedTabs,
        });
      } else {
        set({ openTabs: updatedTabs });
      }
      
      // Reload file tree
      await loadFileTree();
      
      // 恢复文件夹展开状态
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

  // Create a new folder
  createFolder: async (parentPath: string, name: string) => {
    const { notesPath, loadFileTree, rootFolder } = get();
    
    // 保存当前展开的文件夹路径
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    try {
      const folderPath = parentPath ? `${parentPath}/${name}` : name;
      const fullPath = await join(notesPath, folderPath);
      
      await mkdir(fullPath, { recursive: true });
      
      // Reload file tree
      await loadFileTree();
      
      // 恢复文件夹展开状态
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

  // Delete a folder
  deleteFolder: async (path: string) => {
    const { notesPath, loadFileTree, rootFolder } = get();
    
    // 保存当前展开的文件夹路径
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    try {
      const fullPath = await join(notesPath, path);
      await remove(fullPath, { recursive: true });
      
      // Reload file tree
      await loadFileTree();
      
      // 恢复文件夹展开状态
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

  // Move item (file or folder) to a new location
  moveItem: async (sourcePath: string, targetFolderPath: string) => {
    const { notesPath, currentNote, loadFileTree, rootFolder, openTabs } = get();
    
    // 保存当前展开的文件夹路径
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
    try {
      const fileName = sourcePath.split('/').pop() || '';
      const newPath = targetFolderPath ? `${targetFolderPath}/${fileName}` : fileName;
      const sourceFullPath = await join(notesPath, sourcePath);
      const targetFullPath = await join(notesPath, newPath);
      
      await rename(sourceFullPath, targetFullPath);
      
      // 更新 displayNames (内部方法)
      moveDisplayNameInternal(set, sourcePath, newPath);
      
      // 更新 openTabs
      const updatedTabs = openTabs.map(tab => 
        tab.path === sourcePath ? { ...tab, path: newPath } : tab
      );
      
      // Update current note path if moved
      if (currentNote?.path === sourcePath) {
        set({ 
          currentNote: { ...currentNote, path: newPath },
          openTabs: updatedTabs,
        });
      } else {
        set({ openTabs: updatedTabs });
      }
      
      // Reload file tree
      await loadFileTree();
      
      // 恢复文件夹展开状态
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
    if (!currentNote || currentNote.content === content) return;
    
    // 只更新内容和 dirty 状态，标题更新由编辑器的 titleSyncPlugin 实时处理
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
  closeTab: async (path: string) => {
    const { openTabs, currentNote, isDirty, saveNote, notesPath, loadFileTree, rootFolder } = get();
    
    // 检查是否是空笔记（只有 "# " 或空白内容）
    const isEmptyNote = currentNote?.path === path && 
      (!currentNote.content.trim() || currentNote.content.trim() === '#' || currentNote.content.trim() === '# ');
    
    if (isEmptyNote) {
      // 删除空笔记文件
      try {
        const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
        const fullPath = await join(notesPath, path);
        await remove(fullPath);
        
        // 清理 displayNames (内部方法)
        removeDisplayNameInternal(set, path);
        
        // 重新加载文件树
        await loadFileTree();
        
        // 恢复文件夹展开状态
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
        // 忽略删除失败的错误
      }
    } else if (currentNote?.path === path && isDirty) {
      // 保存非空的脏笔记
      await saveNote();
    }
    
    const updatedTabs = openTabs.filter(t => t.path !== path);
    
    // 先更新标签列表
    set({ openTabs: updatedTabs });
    
    // If closing current tab, switch to another
    if (currentNote?.path === path) {
      if (updatedTabs.length > 0) {
        // 切换到最后一个标签
        const lastTab = updatedTabs[updatedTabs.length - 1];
        get().openNote(lastTab.path);
      } else {
        set({ currentNote: null, isDirty: false });
      }
    }
  },

  // Switch to a tab
  switchTab: (path: string) => {
    get().openNote(path);
  },

  // Reorder tabs by drag and drop
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

  // Create note with specific content (for templates/daily notes)
  createNoteWithContent: async (folderPath: string | undefined, name: string, content: string) => {
    let { notesPath, loadFileTree, rootFolder } = get();
    
    // 保存当前展开的文件夹路径
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
    
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
      
      // 恢复文件夹展开状态
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }
      
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

  // Get note icon
  getNoteIcon: (path: string) => {
    return get().noteIcons.get(path);
  },

  // Set note icon
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

  // Sync display name from editor (called by titleSyncPlugin)
  syncDisplayName: (path: string, title: string) => {
    updateDisplayName(set, path, title);
  },

  // Get display name (from H1 title if available, otherwise file name)
  getDisplayName: (path: string) => {
    const state = get();
    return state.displayNames.get(path) || path.split('/').pop()?.replace('.md', '') || 'Untitled';
  },
}));
