import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  // Most common doc
  'File', 'FileText', 'Folder', 'FolderOpen', 'Book', 'BookOpen', 'Notebook', 'Clipboard', 'Pen', 'Pencil',
  'Edit', 'Save', 'Copy', 'ClipboardPaste', 'Trash', 'Search', 'Tag', 'Bookmark', 'Link', 'Hash', 'AtSign',
  'List', 'ListOrdered', 'Table', 'Bold', 'Italic', 'Underline', 'AlignLeft', 'AlignCenter', 'AlignRight',
  // Files
  'Files', 'FilePlus', 'FilePlus2', 'FileMinus', 'FileMinus2', 'FileCheck', 'FileCheck2', 'FileX', 'FileX2',
  'FileUp', 'FileDown', 'FileInput', 'FileOutput', 'FileEdit', 'FilePen', 'FilePenLine', 'FileClock', 'FileHeart', 'FileQuestion', 'FileWarning',
  'FileLock', 'FileLock2', 'FileKey', 'FileKey2', 'FileSearch', 'FileSearch2', 'FileScan', 'FileSymlink', 'FileStack',
  'FileCode', 'FileCode2', 'FileJson', 'FileJson2', 'FileType', 'FileType2', 'FileDigit', 'FileBadge', 'FileBadge2',
  'FileImage', 'FileVideo', 'FileVideo2', 'FileAudio', 'FileAudio2', 'FileMusic', 'FileSpreadsheet', 'FileChartColumn', 'FileChartColumnIncreasing', 'FileChartLine', 'FileChartPie',
  'FileArchive', 'FileBox', 'FileSignature', 'FileTerminal', 'FileSliders', 'FileCog', 'FileCog2', 'FileDiff',
  'FileAxis3D', 'FileAxis3d', 'FileBarChart', 'FileBarChart2', 'FileBraces', 'FileBracesCorner', 'FileCheckCorner', 'FileCodeCorner',
  'FileExclamationPoint', 'FileHeadphone', 'FileLineChart', 'FileMinusCorner', 'FilePieChart', 'FilePlay', 'FilePlusCorner', 'FileQuestionMark',
  'FileSearchCorner', 'FileSignal', 'FileTypeCorner', 'FileUser', 'FileVideoCamera', 'FileVolume', 'FileVolume2', 'FileXCorner',
  // Folders
  'FolderClosed', 'FolderPlus', 'FolderMinus', 'FolderCheck', 'FolderX', 'FolderHeart', 'FolderDot', 'FolderOpenDot',
  'FolderArchive', 'FolderCode', 'FolderCog', 'FolderCog2', 'FolderGit', 'FolderGit2', 'FolderKanban', 'FolderKey', 'FolderLock',
  'FolderSearch', 'FolderSearch2', 'FolderSync', 'FolderSymlink', 'FolderTree', 'FolderUp', 'FolderDown', 'FolderInput', 'FolderOutput', 'FolderRoot',
  'FolderPen', 'FolderClock', 'FolderEdit', 'Folders',
  // Books
  'BookA', 'BookAlert', 'BookAudio', 'BookCheck', 'BookCopy', 'BookDashed', 'BookDown', 'BookHeadphones', 'BookHeart', 'BookImage', 'BookKey',
  'BookLock', 'BookMarked', 'BookMinus', 'BookOpenCheck', 'BookOpenText', 'BookPlus', 'BookTemplate', 'BookText', 'BookType', 'BookUp', 'BookUp2', 'BookUser', 'BookX',
  'Library', 'LibraryBig', 'LibrarySquare', 'SquareLibrary', 'NotebookPen', 'NotebookTabs', 'NotebookText',
  // Documents
  'ScrollText', 'Scroll', 'Receipt', 'ReceiptText', 'Newspaper', 'Album', 'StickyNote', 'NotepadText', 'NotepadTextDashed',
  'ClipboardList', 'ClipboardCheck', 'ClipboardCopy', 'ClipboardPaste', 'ClipboardPen', 'ClipboardPenLine', 'ClipboardSignature', 'ClipboardType',
  'ClipboardMinus', 'ClipboardPlus', 'ClipboardX', 'ClipboardClock', 'ClipboardEdit',
  // Writing
  'PenLine', 'PenTool', 'PenOff', 'PencilLine', 'PencilOff', 'PencilRuler', 'Highlighter', 'Eraser', 'Edit2', 'Edit3',
  // Text Style
  'Type', 'CaseSensitive', 'CaseUpper', 'CaseLower', 'ALargeSmall', 'AArrowUp', 'AArrowDown', 'WholeWord', 'RemoveFormatting',
  'Strikethrough', 'Subscript', 'Superscript', 'Baseline',
  'AlignJustify', 'IndentIncrease', 'IndentDecrease', 'Indent', 'Outdent',
  // Lists
  'ListTree', 'ListTodo', 'ListChecks', 'ListCheck', 'ListPlus', 'ListMinus', 'ListX', 'ListFilter', 'ListFilterPlus',
  'ListStart', 'ListEnd', 'ListRestart', 'ListVideo', 'ListMusic', 'ListCollapse', 'ListChevronsDownUp', 'ListChevronsUpDown', 'ListIndentDecrease', 'ListIndentIncrease',
  'Heading', 'Heading1', 'Heading2', 'Heading3', 'Heading4', 'Heading5', 'Heading6', 'Pilcrow', 'PilcrowLeft', 'PilcrowRight', 'PilcrowSquare',
  'Quote', 'TextQuote', 'MessageSquareQuote', 'Link2', 'Unlink', 'Link2Off', 'Unlink2', 'ExternalLink',
  // Table
  'Table2', 'TableProperties', 'Sheet', 'TableCellsMerge', 'TableCellsSplit', 'Columns2', 'Columns3', 'Columns4', 'Rows2', 'Rows3', 'Rows4', 'Grid2X2', 'Grid3X3', 'LayoutGrid',
  'Printer', 'PrinterCheck', 'SearchCode', 'SearchCheck', 'SearchX', 'SearchSlash', 'FolderSearch', 'FolderSearch2',
  'Tags', 'BookmarkPlus', 'BookmarkMinus', 'BookmarkCheck', 'BookmarkX',
  'MessageSquare', 'MessageCircle', 'Asterisk', 'Info', 'CircleHelp', 'HelpCircle', 'Signature', 'ClipboardSignature', 'LetterText',
  'Text', 'TextCursor', 'TextCursorInput', 'TextSelect', 'TextSearch', 'TextAlignCenter', 'TextAlignEnd', 'TextAlignJustify', 'TextAlignStart',
  'TextInitial', 'TextSelection', 'TextWrap', 'TypeOutline', 'SpellCheck', 'SpellCheck2', 'WrapText', 'Ligature', 'Regex', 'Diff', 'MessageSquareDiff',
  'Braces', 'Brackets', 'Parentheses', 'Slash', 'Space', 'Minus', 'Plus', 'Equal', 'AsteriskSquare', 'Ampersand', 'Ampersands', 'MSquare', 'SquareM', 'MailQuestionMark', 'MessageCircleQuestionMark',
];

export const docIcons: IconCategory = { id: 'doc', name: 'Documents', emoji: getIcon('FileText'), icons: createIconItems(ICONS) };
