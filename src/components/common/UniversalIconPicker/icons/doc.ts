import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  'Description', 'Article', 'Note', 'Notes', 
  'Folder', 'FolderShared', 'FolderSpecial', 'FolderZip',
  'Assignment', 'Assessment', 'Book', 'LibraryBooks',
  'TextSnippet', 'PictureAsPdf', 'InsertDriveFile', 'Topic',
  'ContentPaste', 'FileCopy', 'SnippetFolder', 'RuleFolder',
  'Difference', 'Plagiarism', 'FindInPage', 'FactCheck'
];

export const docIcons: IconCategory = { id: 'doc', name: 'Documents', emoji: getIcon('Description'), icons: createIconItems(ICONS) };