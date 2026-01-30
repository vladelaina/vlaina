import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  'CheckCircle', 'Check', 'Done', 'DoneAll', 'Verified',
  'Cancel', 'Close', 'Block', 'DoNotDisturb',
  'Info', 'Help', 'HelpOutline', 'Support',
  'Warning', 'Error', 'Report', 'ReportProblem',
  'Pending', 'HourglassEmpty', 'HourglassFull',
  'Sync', 'SyncProblem', 'Loop', 'Autorenew',
  'PriorityHigh', 'LowPriority', 'Flag', 'OutlinedFlag',
  'Notifications', 'NotificationsActive', 'NotificationsPaused',
  'BatteryFull', 'BatteryAlert', 'BatteryChargingFull',
  'SignalWifi4Bar', 'SignalWifiOff', 'NetworkCheck'
];

export const statusIcons: IconCategory = { id: 'status', name: 'Status', emoji: getIcon('CheckCircle'), icons: createIconItems(ICONS) };