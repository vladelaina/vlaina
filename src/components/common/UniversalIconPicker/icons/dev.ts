import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  // Most common dev
  'Code', 'Terminal', 'Database', 'Server', 'Cloud', 'Globe', 'Settings', 'Cog', 'Bug', 'Shield', 'Lock', 'Key',
  'Cpu', 'Monitor', 'Laptop', 'Smartphone', 'Wifi', 'Network', 'GitBranch', 'Github', 'Package', 'Box', 'Layers',
  'Table', 'Grid', 'Layout', 'Component', 'Blocks', 'Puzzle', 'ChartBar', 'BarChart', 'PieChart',
  // Code
  'Code2', 'CodeXml', 'CodeSquare', 'SquareCode', 'Braces', 'Brackets', 'CurlyBraces', 'TerminalSquare', 'SquareTerminal', 'Binary', 'Hash', 'Regex',
  'FileCode', 'FileCode2', 'FileJson', 'FileJson2', 'FileType', 'FileType2', 'FileDigit', 'FileDiff', 'FileTerminal',
  // Git
  'GitBranch', 'GitBranchPlus', 'GitBranchMinus', 'GitCommit', 'GitCommitHorizontal', 'GitCommitVertical', 'GitCompare', 'GitCompareArrows', 'GitFork', 'GitGraph',
  'GitMerge', 'GitPullRequest', 'GitPullRequestArrow', 'GitPullRequestClosed', 'GitPullRequestCreate', 'GitPullRequestCreateArrow', 'GitPullRequestDraft',
  // Brands
  'Gitlab', 'Codepen', 'Codesandbox', 'Figma', 'Chrome', 'Chromium', 'Facebook', 'Instagram', 'Twitter', 'Linkedin', 'Youtube', 'Twitch', 'Dribbble', 'Framer', 'Slack', 'Trello',
  // Database & Server
  'DatabaseBackup', 'DatabaseZap', 'ServerCog', 'ServerCrash', 'ServerOff', 'HardDrive', 'HardDriveDownload', 'HardDriveUpload', 'Cylinder',
  'CloudCog', 'CloudDownload', 'CloudUpload', 'CloudOff', 'CloudAlert', 'CloudCheck',
  // Network
  'Globe2', 'GlobeLock', 'Earth', 'EarthLock', 'Workflow', 'Waypoints', 'Route', 'Webhook', 'WebhookOff', 'Rss', 'Podcast',
  'Plug', 'Plug2', 'PlugZap', 'PlugZap2', 'Unplug', 'Cable', 'Usb', 'EthernetPort', 'HdmiPort', 'Router', 'WifiCog', 'WifiPen', 'WifiSync', 'Nfc', 'Bluetooth', 'BluetoothConnected',
  // Container & Package
  'Container', 'Boxes', 'BoxSelect', 'PackageOpen', 'PackageCheck', 'PackagePlus', 'PackageMinus', 'PackageX', 'PackageSearch', 'Archive', 'ArchiveRestore', 'ArchiveX',
  // Build & Tools
  'Hammer', 'Wrench', 'Settings2', 'SlidersHorizontal', 'SlidersVertical', 'Construction', 'HardHat',
  'BugOff', 'BugPlay', 'TestTube', 'TestTubes', 'TestTube2', 'FlaskConical', 'FlaskConicalOff', 'FlaskRound', 'Beaker',
  // Security
  'ShieldCheck', 'ShieldOff', 'ShieldAlert', 'ShieldQuestion', 'ShieldPlus', 'ShieldMinus', 'ShieldEllipsis', 'ShieldHalf',
  'LockOpen', 'Unlock', 'LockKeyhole', 'LockKeyholeOpen', 'KeyRound', 'KeySquare', 'Fingerprint', 'ScanFace', 'ScanEye', 'QrCode', 'Barcode',
  // Hardware
  'Gpu', 'CircuitBoard', 'MemoryStick', 'Microchip', 'MonitorSmartphone', 'MonitorSpeaker', 'MonitorCheck', 'MonitorX',
  'MonitorDot', 'MonitorOff', 'MonitorPause', 'MonitorPlay', 'MonitorStop', 'MonitorUp', 'MonitorDown', 'MonitorCog',
  'Laptop2', 'LaptopMinimal', 'LaptopMinimalCheck', 'Computer', 'PcCase', 'Dock',
  'SmartphoneCharging', 'SmartphoneNfc', 'Tablet', 'TabletSmartphone', 'Tablets', 'Vibrate', 'VibrateOff', 'SwitchCamera',
  'Keyboard', 'KeyboardMusic', 'KeyboardOff', 'Mouse', 'MousePointer', 'MousePointer2', 'MousePointerClick', 'MousePointerBan', 'Touchpad', 'TouchpadOff',
  'Tv', 'Tv2', 'TvMinimal', 'TvMinimalPlay', 'Projector', 'Presentation', 'ScreenShare', 'ScreenShareOff', 'Cast', 'Airplay',
  'Printer', 'PrinterCheck', 'Webcam', 'Speaker', 'Headphones', 'HeadphoneOff', 'Headset',
  // Layout
  'Layers2', 'Layers3', 'LayoutDashboard', 'LayoutTemplate', 'LayoutPanelLeft', 'LayoutPanelTop', 'LayoutGrid', 'LayoutList',
  'PanelLeft', 'PanelLeftClose', 'PanelLeftOpen', 'PanelLeftDashed', 'PanelRight', 'PanelRightClose', 'PanelRightOpen', 'PanelRightDashed',
  'PanelTop', 'PanelTopClose', 'PanelTopOpen', 'PanelTopDashed', 'PanelBottom', 'PanelBottomClose', 'PanelBottomOpen', 'PanelBottomDashed',
  'PanelsTopLeft', 'PanelsRightBottom', 'PanelsLeftBottom', 'Sidebar', 'SidebarClose', 'SidebarOpen', 'AppWindow', 'AppWindowMac',
  'Grid2X2', 'Grid2X2Check', 'Grid2X2Plus', 'Grid2X2X', 'Grid2x2', 'Grid2x2Check', 'Grid2x2Plus', 'Grid2x2X', 'Grid3X3', 'Grid3x3', 'Grid3x2', 'Grip', 'GripHorizontal', 'GripVertical',
  'Columns', 'Columns2', 'Columns3', 'Columns4', 'Columns3Cog', 'ColumnsSettings', 'Rows', 'Rows2', 'Rows3', 'Rows4',
  'Table2', 'TableProperties', 'Sheet', 'TableCellsMerge', 'TableCellsSplit', 'TableColumnsSplit', 'TableRowsSplit', 'TableConfig', 'TableOfContents',
  // Charts
  'ChartArea', 'ChartBar', 'ChartBarBig', 'ChartBarDecreasing', 'ChartBarIncreasing', 'ChartBarStacked',
  'ChartCandlestick', 'ChartColumn', 'ChartColumnBig', 'ChartColumnDecreasing', 'ChartColumnIncreasing', 'ChartColumnStacked',
  'ChartGantt', 'ChartLine', 'ChartNetwork', 'ChartNoAxesColumn', 'ChartNoAxesColumnDecreasing', 'ChartNoAxesColumnIncreasing',
  'ChartNoAxesCombined', 'ChartNoAxesGantt', 'ChartPie', 'ChartScatter', 'ChartSpline',
  'BarChart2', 'BarChart3', 'BarChart4', 'BarChartBig', 'BarChartHorizontal', 'BarChartHorizontalBig',
  'LineChart', 'AreaChart', 'CandlestickChart', 'GanttChart', 'GanttChartSquare', 'ScatterChart', 'SquareChartGantt', 'SquareGanttChart', 'SquareKanban',
  'Kanban', 'KanbanSquare', 'KanbanSquareDashed',
  // Form & Function
  'Form', 'FormInput', 'TextCursorInput', 'RectangleEllipsis', 'SquareAsterisk', 'Asterisk', 'Calculator',
  'FunctionSquare', 'SquareFunction', 'Variable', 'Sigma', 'Pi', 'Axis3D', 'Axis3d', 'Diff', 'ScrollText', 'Logs', 'Inspect', 'InspectionPanel', 'Orbit',
  'DecimalsArrowLeft', 'DecimalsArrowRight', 'Tally1', 'Tally2', 'Tally3', 'Tally4', 'Tally5', 'Omega',
  // Extended
  'PanelBottomInactive', 'PanelLeftInactive', 'PanelRightInactive', 'PanelTopInactive', 'PanelLeftRightDashed', 'PanelTopBottomDashed', 'PanelsLeftRight', 'PanelsTopBottom',
  'SquareBottomDashedScissors', 'SquareDashedBottom', 'SquareDashedBottomCode', 'SquareDashedKanban', 'SquareDashedMousePointer', 'SquareDashedTopSolid',
  'DotSquare', 'MenuSquare', 'SlashSquare', 'SigmaSquare', 'PiSquare', 'TestTubeDiagonal', 'Package2',
];

export const devIcons: IconCategory = { id: 'dev', name: 'Development', emoji: getIcon('Code'), icons: createIconItems(ICONS) };
