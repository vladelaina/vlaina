import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  // Most common
  'Star', 'Heart', 'Check', 'X', 'Plus', 'Minus', 'Search', 'Settings', 'Home', 'Menu', 'MoreHorizontal', 'MoreVertical',
  'Edit', 'Trash', 'Save', 'Copy', 'ClipboardPaste', 'Scissors', 'Undo', 'Redo', 'RefreshCw', 'Download', 'Upload', 'Share', 'Link',
  'Pin', 'Bookmark', 'Flag', 'Tag', 'Filter', 'ArrowUpDown', 'Grid', 'List', 'Eye', 'EyeOff', 'Lock', 'Unlock',
  // Stars & Hearts
  'StarHalf', 'StarOff', 'Stars', 'Sparkle', 'Sparkles', 'Heart', 'HeartOff', 'HeartCrack', 'HeartPulse', 'HeartHandshake',
  // Check & X
  'CheckCheck', 'CheckCircle', 'CheckCircle2', 'CheckSquare', 'CheckSquare2', 'CircleCheck', 'CircleCheckBig', 'SquareCheck', 'SquareCheckBig', 'CheckLine',
  'XCircle', 'XSquare', 'CircleX', 'SquareX', 'XOctagon', 'OctagonX',
  // Plus & Minus
  'PlusCircle', 'PlusSquare', 'CirclePlus', 'SquarePlus', 'MinusCircle', 'MinusSquare', 'CircleMinus', 'SquareMinus',
  // Actions
  'Edit2', 'Edit3', 'Pencil', 'PencilLine', 'Pen', 'PenLine', 'PenTool', 'PenBox', 'PenSquare',
  'Trash2', 'Delete', 'Eraser', 'Save', 'SaveAll', 'SaveOff',
  'Copy', 'CopyPlus', 'CopyMinus', 'CopyCheck', 'CopyX', 'CopySlash',
  'Clipboard', 'ClipboardCopy', 'ClipboardPaste', 'ClipboardCheck', 'ClipboardX', 'ClipboardList', 'ClipboardType', 'ClipboardSignature', 'ClipboardPen', 'ClipboardPenLine',
  'Scissors', 'ScissorsLineDashed', 'ScissorsSquare', 'ScissorsSquareDashedBottom',
  'Undo2', 'Redo2', 'UndoDot', 'RedoDot', 'History', 'IterationCw', 'IterationCcw',
  'RefreshCw', 'RefreshCcw', 'RefreshCwOff', 'RefreshCcwDot', 'RotateCw', 'RotateCcw', 'Rotate3D', 'Rotate3d', 'RotateCcwKey', 'RotateCcwSquare', 'RotateCwSquare',
  // Navigation
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUpDown', 'ArrowLeftRight',
  'ChevronUp', 'ChevronDown', 'ChevronLeft', 'ChevronRight', 'ChevronFirst', 'ChevronLast',
  'ChevronsUp', 'ChevronsDown', 'ChevronsLeft', 'ChevronsRight', 'ChevronsUpDown', 'ChevronsDownUp', 'ChevronsLeftRight', 'ChevronsRightLeft', 'ChevronsLeftRightEllipsis',
  'ArrowUpLeft', 'ArrowUpRight', 'ArrowDownLeft', 'ArrowDownRight',
  'ArrowBigUp', 'ArrowBigDown', 'ArrowBigLeft', 'ArrowBigRight', 'ArrowBigUpDash', 'ArrowBigDownDash', 'ArrowBigLeftDash', 'ArrowBigRightDash',
  'Move', 'MoveUp', 'MoveDown', 'MoveLeft', 'MoveRight', 'MoveUpLeft', 'MoveUpRight', 'MoveDownLeft', 'MoveDownRight', 'Move3D', 'MoveHorizontal', 'MoveVertical', 'MoveDiagonal', 'MoveDiagonal2',
  // Arrow variants
  'ArrowUpCircle', 'ArrowDownCircle', 'ArrowLeftCircle', 'ArrowRightCircle', 'CircleArrowUp', 'CircleArrowDown', 'CircleArrowLeft', 'CircleArrowRight',
  'CircleArrowOutUpLeft', 'CircleArrowOutUpRight', 'CircleArrowOutDownLeft', 'CircleArrowOutDownRight',
  'ArrowUpSquare', 'ArrowDownSquare', 'ArrowLeftSquare', 'ArrowRightSquare', 'ArrowUpLeftSquare', 'ArrowUpRightSquare', 'ArrowDownLeftSquare', 'ArrowDownRightSquare',
  'ArrowUpFromLine', 'ArrowDownFromLine', 'ArrowLeftFromLine', 'ArrowRightFromLine', 'ArrowUpToLine', 'ArrowDownToLine', 'ArrowLeftToLine', 'ArrowRightToLine',
  'ArrowUpFromDot', 'ArrowDownToDot', 'ArrowsUpFromLine', 'ArrowDownLeftFromCircle', 'ArrowDownLeftFromSquare', 'ArrowDownRightFromCircle', 'ArrowDownRightFromSquare',
  'ArrowUpLeftFromCircle', 'ArrowUpLeftFromSquare', 'ArrowUpRightFromCircle', 'ArrowUpRightFromSquare',
  'ArrowDownUp', 'ArrowRightLeft', 'ArrowUpNarrowWide', 'ArrowDownNarrowWide', 'ArrowUpWideNarrow', 'ArrowDownWideNarrow',
  'ArrowUpAZ', 'ArrowDownAZ', 'ArrowUpZA', 'ArrowDownZA', 'ArrowUpAz', 'ArrowDownAz', 'ArrowUpZa', 'ArrowDownZa', 'ArrowUp01', 'ArrowDown01', 'ArrowUp10', 'ArrowDown10',
  'ChevronUpCircle', 'ChevronDownCircle', 'ChevronLeftCircle', 'ChevronRightCircle', 'ChevronUpSquare', 'ChevronDownSquare', 'ChevronLeftSquare', 'ChevronRightSquare',
  'CircleChevronUp', 'CircleChevronDown', 'CircleChevronLeft', 'CircleChevronRight',
  'CornerUpLeft', 'CornerUpRight', 'CornerDownLeft', 'CornerDownRight', 'CornerLeftUp', 'CornerLeftDown', 'CornerRightUp', 'CornerRightDown',
  // Shapes
  'Circle', 'Square', 'Triangle', 'Diamond', 'Hexagon', 'Octagon', 'Pentagon', 'Star',
  'CircleDot', 'CircleDotDashed', 'CircleDashed', 'CircleEqual', 'CircleEllipsis', 'CircleSlash', 'CircleSlash2', 'CircleSlashed', 'CircleOff', 'CircleSmall', 'CircleStar', 'CirclePoundSterling',
  'SquareDot', 'SquareDashed', 'SquareSlash', 'SquareActivity', 'SquareArrowDown', 'SquareArrowDownLeft', 'SquareArrowDownRight',
  'SquareArrowLeft', 'SquareArrowRight', 'SquareArrowUp', 'SquareArrowUpLeft', 'SquareArrowUpRight',
  'SquareChevronDown', 'SquareChevronLeft', 'SquareChevronRight', 'SquareChevronUp', 'SquareDivide', 'SquareEqual', 'SquareMenu', 'SquareMousePointer',
  'SquarePause', 'SquarePen', 'SquarePercent', 'SquarePi', 'SquarePilcrow', 'SquarePower', 'SquareRadical', 'SquareRoundCorner', 'SquareScissors',
  'SquareSigma', 'SquareSplitHorizontal', 'SquareSplitVertical', 'SquareSquare', 'SquareStack', 'SquareStar',
  'SquaresExclude', 'SquaresIntersect', 'SquaresSubtract', 'SquaresUnite', 'Squircle', 'SquircleDashed',
  'TriangleRight', 'TriangleDashed', 'OctagonMinus', 'Torus', 'Pyramid', 'Radical',
  // Math
  'Divide', 'DivideCircle', 'DivideSquare', 'CircleDivide', 'Equal', 'EqualNot', 'EqualSquare', 'EqualApproximately',
  'Percent', 'CirclePercent', 'DiamondPercent', 'BadgePercent', 'PercentCircle', 'PercentDiamond', 'PercentSquare',
  'Sigma', 'Pi', 'Infinity', 'Hash', 'Asterisk', 'AsteriskSquare', 'Dot', 'Ellipsis', 'EllipsisVertical',
  // Transform
  'Expand', 'Shrink', 'Maximize', 'Maximize2', 'Minimize', 'Minimize2', 'Fullscreen', 'ScanLine',
  'FlipHorizontal', 'FlipHorizontal2', 'FlipVertical', 'FlipVertical2', 'ZoomIn', 'ZoomOut', 'Crop',
  // Align
  'AlignLeft', 'AlignCenter', 'AlignRight', 'AlignJustify', 'AlignStartVertical', 'AlignCenterVertical', 'AlignEndVertical',
  'AlignStartHorizontal', 'AlignCenterHorizontal', 'AlignEndHorizontal',
  'AlignHorizontalDistributeCenter', 'AlignHorizontalDistributeEnd', 'AlignHorizontalDistributeStart',
  'AlignVerticalDistributeCenter', 'AlignVerticalDistributeEnd', 'AlignVerticalDistributeStart',
  'AlignHorizontalJustifyCenter', 'AlignHorizontalJustifyEnd', 'AlignHorizontalJustifyStart',
  'AlignVerticalJustifyCenter', 'AlignVerticalJustifyEnd', 'AlignVerticalJustifyStart',
  'AlignHorizontalSpaceAround', 'AlignHorizontalSpaceBetween', 'AlignVerticalSpaceAround', 'AlignVerticalSpaceBetween',
  'BetweenHorizontalStart', 'BetweenHorizontalEnd', 'BetweenVerticalStart', 'BetweenVerticalEnd', 'BetweenHorizonalStart', 'BetweenHorizonalEnd',
  'BringToFront', 'SendToBack', 'Combine', 'Split', 'Merge', 'Ungroup', 'Group', 'SplitSquareHorizontal', 'SplitSquareVertical', 'Replace', 'ReplaceAll',
  'FoldHorizontal', 'FoldVertical', 'UnfoldHorizontal', 'UnfoldVertical', 'SeparatorHorizontal', 'SeparatorVertical', 'WrapText', 'Baseline',
  // Pointer & Target
  'Crosshair', 'Focus', 'Scan', 'ScanFace', 'ScanEye', 'ScanText', 'ScanBarcode', 'ScanSearch', 'Target', 'Goal', 'Locate', 'LocateFixed', 'LocateOff',
  'Navigation', 'Navigation2', 'NavigationOff', 'Compass', 'Pointer', 'PointerOff', 'MousePointer', 'MousePointer2', 'MousePointerClick',
  'MouseOff', 'MousePointer2Off', 'MousePointerSquareDashed', 'Hand', 'HandMetal', 'Grab', 'HandFist', 'HandGrab', 'TextCursor', 'TextCursorInput',
  // Links
  'ExternalLink', 'SquareArrowOutUpRight', 'SquareArrowOutUpLeft', 'SquareArrowOutDownRight', 'SquareArrowOutDownLeft',
  'Link', 'Link2', 'Unlink', 'Link2Off', 'Unlink2', 'Share', 'Share2', 'Forward', 'Reply', 'ReplyAll',
  'Download', 'Upload', 'Import', 'FileDown', 'FileUp', 'CloudDownload', 'CloudUpload', 'DownloadCloud', 'UploadCloud', 'LogIn', 'LogOut',
  // Bookmark & Pin
  'Pin', 'PinOff', 'Bookmark', 'BookmarkPlus', 'BookmarkMinus', 'BookmarkCheck', 'BookmarkX',
  'Flag', 'FlagOff', 'FlagTriangleLeft', 'FlagTriangleRight', 'Tag', 'Tags',
  // Misc
  'Award', 'Trophy', 'Medal', 'Crown', 'Gem', 'Gift', 'Zap', 'ZapOff', 'Bolt', 'Flame', 'FlameKindling', 'Bomb',
  'Power', 'PowerOff', 'PowerCircle', 'CirclePower', 'PowerSquare', 'SquarePower', 'Command', 'Option', 'AtSign',
  'Copyright', 'Copyleft', 'CreativeCommons', 'Regex', 'Ampersand', 'Ampersands', 'StretchHorizontal', 'StretchVertical', 'Proportions', 'Ratio',
  'Lightbulb', 'LightbulbOff', 'Filter', 'FilterX', 'Funnel', 'FunnelPlus', 'FunnelX', 'Sliders', 'Layout', 'Section',
  'Wand', 'Wand2', 'WandSparkles', 'VectorSquare', 'SplinePointer', 'Tangent', 'LineSquiggle', 'Origami', 'Ribbon', 'SortAsc', 'SortDesc', 'SendHorizonal',
  'Grip', 'GripHorizontal', 'GripVertical', 'Menu',
];

export const commonIcons: IconCategory = { id: 'common', name: 'Common', emoji: getIcon('Shapes'), icons: createIconItems(ICONS) };
