import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  // Actions
  'Add', 'Remove', 'Close', 'Check', 'Edit', 'Delete', 'Save', 'Search',
  'ContentCopy', 'ContentCut', 'ContentPaste', 'Undo', 'Redo', 'Refresh',
  'Favorite', 'Star', 'ThumbUp', 'ThumbDown', 'Share', 'Download', 'Upload',
  'FilterList', 'Sort', 'Settings', 'Menu', 'MoreHoriz', 'MoreVert',
  'Link', 'LinkOff', 'Flag', 'Bookmark', 'Label',
  
  // Navigation
  'ArrowBack', 'ArrowForward', 'ArrowUpward', 'ArrowDownward',
  'ChevronLeft', 'ChevronRight', 'ExpandLess', 'ExpandMore',
  'Home', 'Apps', 'ArrowBackIos', 'ArrowForwardIos',
  'Fullscreen', 'FullscreenExit', 'Refresh', 'Sync',
  
  // Objects/Shapes
  'Circle', 'Square', 'ChangeHistory', 'Hexagon', 'Polyline',
  'CheckBox', 'CheckBoxOutlineBlank', 'RadioButtonChecked', 'RadioButtonUnchecked',
  
  // Alerts
  'Warning', 'Error', 'Info', 'Help', 'Notifications', 'NotificationsActive', 'NotificationsOff',
  
  // Time/Date
  'AccessTime', 'DateRange', 'Event', 'Schedule', 'Timer', 'HourglassEmpty', 'Update', 'History',
  
  // Files
  'Folder', 'FolderOpen', 'Description', 'AttachFile', 'Cloud', 'CloudUpload', 'CloudDownload',
  
  // Communication
  'Email', 'Chat', 'Phone', 'Call', 'Person', 'Group', 'Message', 'Send',
  
  // Misc
  'Lock', 'LockOpen', 'Visibility', 'VisibilityOff', 'PowerSettingsNew',
  'Bolt', 'LightMode', 'DarkMode', 'Palette', 'Language', 'Translate',
  'ZoomIn', 'ZoomOut', 'Print', 'Dashboard'
];

export const commonIcons: IconCategory = { id: 'common', name: 'Common', emoji: getIcon('Category'), icons: createIconItems(ICONS) };