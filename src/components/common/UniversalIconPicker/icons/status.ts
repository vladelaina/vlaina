import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  // Most common status
  'Check', 'X', 'AlertCircle', 'AlertTriangle', 'Info', 'HelpCircle', 'Bell', 'Eye', 'EyeOff', 'Lock', 'Unlock',
  'Play', 'Pause', 'CircleStop', 'Power', 'Wifi', 'WifiOff', 'Bluetooth', 'Battery', 'Volume', 'VolumeX',
  'Sun', 'Moon', 'Star', 'Heart', 'ThumbsUp', 'ThumbsDown', 'Loader', 'RefreshCw', 'Clock',
  // Success
  'CircleCheck', 'CircleCheckBig', 'CheckCircle', 'CheckCircle2', 'SquareCheck', 'SquareCheckBig', 'CheckSquare', 'CheckSquare2',
  'BadgeCheck', 'ShieldCheck', 'ListCheck', 'ListChecks', 'ClipboardCheck', 'CalendarCheck', 'CalendarCheck2', 'FileCheck', 'FileCheck2', 'UserCheck', 'UserCheck2', 'MailCheck',
  // Error
  'CircleX', 'XCircle', 'XOctagon', 'OctagonX', 'SquareX', 'XSquare', 'BadgeX', 'ShieldX', 'CalendarX', 'CalendarX2', 'FileX', 'FileX2', 'UserX', 'UserX2', 'MailX',
  'Ban', 'Slash', 'CircleSlash', 'CircleSlash2', 'CircleOff', 'SquareSlash',
  // Alerts
  'AlertOctagon', 'CircleAlert', 'TriangleAlert', 'OctagonAlert', 'ShieldAlert', 'BadgeAlert', 'MessageSquareWarning', 'FileWarning', 'BellRing',
  'CircleHelp', 'BadgeInfo', 'BadgeHelp', 'CircleQuestionMark', 'BadgeQuestionMark', 'FileQuestion',
  // Loading
  'Loader2', 'LoaderCircle', 'LoaderPinwheel', 'Hourglass', 'Timer', 'TimerOff', 'TimerReset',
  'ClockAlert', 'ClockArrowUp', 'ClockArrowDown', 'CircleDashed', 'CircleDotDashed',
  // Playback
  'PlayCircle', 'CirclePlay', 'PlaySquare', 'SquarePlay', 'PauseCircle', 'CirclePause', 'PauseOctagon', 'OctagonPause',
  'StopCircle', 'CircleStop', 'SquareStop', 'SkipBack', 'SkipForward', 'Rewind', 'FastForward', 'StepBack', 'StepForward',
  'Circle', 'CircleDot', 'Disc', 'Disc2', 'Disc3', 'ToggleLeft', 'ToggleRight',
  // Power & Lock
  'PowerOff', 'PowerCircle', 'CirclePower', 'LockOpen', 'LockKeyhole', 'LockKeyholeOpen', 'ShieldOff', 'ShieldQuestion',
  'EyeClosed', 'View',
  // Notifications
  'BellOff', 'BellPlus', 'BellMinus', 'BellDot', 'BellElectric',
  // Connectivity
  'WifiHigh', 'WifiLow', 'WifiZero', 'Signal', 'SignalHigh', 'SignalMedium', 'SignalLow', 'SignalZero', 'Antenna', 'Radio', 'RadioReceiver', 'RadioTower',
  'BluetoothOff', 'BluetoothConnected', 'BluetoothSearching', 'Plug', 'PlugZap', 'PlugZap2', 'Unplug', 'Cable', 'CableCar',
  // Battery
  'BatteryLow', 'BatteryMedium', 'BatteryFull', 'BatteryCharging', 'BatteryWarning', 'BatteryPlus',
  // Volume
  'Volume1', 'Volume2', 'VolumeOff',
  // Environment
  'SunDim', 'SunMedium', 'SunMoon', 'MoonStar', 'Contrast', 'Eclipse',
  'Thermometer', 'ThermometerSun', 'ThermometerSnowflake', 'Gauge', 'GaugeCircle', 'CircleGauge',
  // Activity
  'Activity', 'ActivitySquare', 'HeartPulse', 'TrendingUp', 'TrendingDown', 'TrendingUpDown',
  'RefreshCcw', 'RefreshCwOff', 'RotateCw', 'RotateCcw', 'FolderSync', 'CalendarSync',
  'Globe', 'GlobeLock', 'CloudOff', 'ServerOff', 'Verified', 'StarOff', 'StarHalf', 'HeartOff', 'HeartCrack',
  // Priority
  'ChevronsUp', 'ChevronUp', 'Minus', 'ChevronDown', 'ChevronsDown', 'ArrowBigUp', 'ArrowBigDown',
  // Currency
  'CircleDollarSign', 'BadgeDollarSign', 'BadgeEuro', 'BadgePoundSterling', 'BadgeIndianRupee', 'BadgeJapaneseYen', 'BadgeRussianRuble', 'BadgeSwissFranc', 'BadgeCent', 'BadgeTurkishLira',
  // Extended
  'CircleFadingPlus', 'CircleFadingArrowUp', 'CircleParking', 'CircleParkingOff', 'ParkingCircle', 'ParkingSquare', 'SquareParking', 'SquareParkingOff', 'ParkingMeter',
  'ShieldBan', 'ShieldClose', 'ShieldQuestionMark', 'UnlockKeyhole', 'FingerprintPattern',
];

export const statusIcons: IconCategory = { id: 'status', name: 'Status', emoji: getIcon('CircleCheck'), icons: createIconItems(ICONS) };
