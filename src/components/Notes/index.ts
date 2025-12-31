/**
 * Notes Module - Markdown notes system
 * 
 * Provides a file tree navigation and WYSIWYG Markdown editor
 * for managing local .md files.
 * 
 * Features:
 * - File tree navigation with folders
 * - WYSIWYG Markdown editing (Milkdown)
 * - Quick search (Ctrl+P)
 * - Outline view
 * - Recent notes
 * - Word count & reading time
 * - Keyboard shortcuts
 */

export { NotesPage } from './NotesPage';
export { FileTree } from './features/FileTree';
export { MarkdownEditor } from './features/Editor/MarkdownEditor';
export { NoteSearch } from './features/Search';
export { NoteOutline } from './features/Outline';
export { KeyboardShortcuts } from './features/Help';
