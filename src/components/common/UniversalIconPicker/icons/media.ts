import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  // Most common media icons first
  'Image', 'Video', 'Music', 'Camera', 'Play', 'Pause', 'Volume', 'Mic', 'Monitor', 'Smartphone',
  'Film', 'Headphones', 'Speaker', 'Tv', 'Laptop', 'Palette', 'Layers', 'Gamepad', 'Radio', 'Disc',
  // Image
  'ImagePlus', 'ImageMinus', 'ImageOff', 'ImageDown', 'ImageUp', 'ImageUpscale', 'Images', 'ImagePlay',
  'FileImage', 'GalleryHorizontal', 'GalleryHorizontalEnd', 'GalleryVertical', 'GalleryVerticalEnd', 'GalleryThumbnails',
  'CameraOff', 'Cctv', 'Aperture', 'Focus', 'ScanLine',
  'Frame', 'Crop', 'Maximize', 'Minimize', 'Expand', 'Shrink', 'ZoomIn', 'ZoomOut', 'Move', 'Move3D',
  'RectangleHorizontal', 'RectangleVertical', 'RectangleCircle', 'Square', 'SquareDashed', 'PictureInPicture', 'PictureInPicture2', 'Wallpaper',
  // Video
  'VideoOff', 'Webcam', 'Clapperboard', 'MonitorPlay', 'Tv2', 'TvMinimal', 'TvMinimalPlay', 'FileVideo', 'FileVideo2',
  'PlayCircle', 'CirclePlay', 'PlaySquare', 'SquarePlay', 'PauseCircle', 'CirclePause', 'StopCircle', 'CircleStop', 'SquareStop',
  'SkipBack', 'SkipForward', 'Rewind', 'FastForward', 'StepBack', 'StepForward', 'ChevronFirst', 'ChevronLast',
  'Repeat', 'Repeat1', 'Repeat2', 'Shuffle', 'Captions', 'CaptionsOff', 'Subtitles', 'ClosedCaption',
  // Audio
  'Music2', 'Music3', 'Music4', 'AudioLines', 'AudioWaveform', 'FileAudio', 'FileAudio2', 'FileMusic', 'ListMusic',
  'MicOff', 'Mic2', 'MicVocal', 'Volume1', 'Volume2', 'VolumeX', 'VolumeOff', 'HeadphoneOff', 'Headset',
  'Radio', 'RadioReceiver', 'RadioTower', 'Podcast', 'Rss', 'Guitar', 'Drum', 'Piano', 'Disc', 'Disc2', 'Disc3', 'DiscAlbum', 'BoomBox', 'Bluetooth', 'BluetoothConnected', 'CassetteTape',
  // Gaming
  'Gamepad', 'Gamepad2', 'GamepadDirectional', 'Joystick', 'Dices', 'Dice1', 'Dice2', 'Dice3', 'Dice4', 'Dice5', 'Dice6', 'Puzzle', 'ToyBrick',
  'Swords', 'Sword', 'Shield', 'ShieldHalf', 'BowArrow', 'Trophy', 'Award', 'Medal', 'Crown', 'Target', 'Crosshair',
  'ChessBishop', 'ChessKing', 'ChessKnight', 'ChessPawn', 'ChessQueen', 'ChessRook', 'Club', 'Spade', 'Volleyball',
  // Entertainment
  'Drama', 'Theater', 'Ticket', 'TicketCheck', 'TicketMinus', 'TicketPlus', 'TicketX', 'TicketPercent', 'TicketSlash',
  'Popcorn', 'PartyPopper', 'Sparkles', 'Sparkle', 'FerrisWheel', 'RollerCoaster', 'Binoculars', 'Videotape', 'Turntable',
  // Art
  'PaintBucket', 'PaintRoller', 'Paintbrush', 'Paintbrush2', 'PaintbrushVertical', 'Brush', 'BrushCleaning',
  'Pipette', 'Droplet', 'Droplets', 'DropletOff', 'Blend', 'Contrast', 'SprayCan', 'SwatchBook',
  'Shapes', 'Triangle', 'TriangleRight', 'Circle', 'CircleDashed', 'Pentagon', 'Hexagon', 'Octagon', 'Diamond', 'DiamondPlus', 'DiamondMinus', 'DiamondPercent',
  'Heart', 'Star', 'Spline', 'Cone', 'Cylinder', 'Cuboid', 'Box', 'Boxes',
  // Design
  'PenTool', 'Pencil', 'PencilRuler', 'Ruler', 'Scissors', 'Slice', 'Layers2', 'Layers3', 'Group', 'Ungroup',
  'BringToFront', 'SendToBack', 'FlipHorizontal', 'FlipHorizontal2', 'FlipVertical', 'FlipVertical2', 'RotateCw', 'RotateCcw', 'Rotate3D', 'Rotate3d',
  'Axis3D', 'Axis3d', 'Move3d', 'Scale3D', 'Scale3d', 'Orbit',
  // Screen
  'MonitorSmartphone', 'MonitorSpeaker', 'MonitorCheck', 'MonitorX', 'MonitorDot', 'MonitorOff', 'MonitorPause', 'MonitorStop', 'MonitorUp', 'MonitorDown',
  'Laptop2', 'LaptopMinimal', 'LaptopMinimalCheck', 'Tablet', 'TabletSmartphone', 'Projector', 'Presentation', 'ScreenShare', 'ScreenShareOff', 'Cast', 'Airplay',
  'HardDrive', 'HardDriveDownload', 'HardDriveUpload', 'Usb', 'Save', 'SaveAll', 'SaveOff', 'FolderArchive',
  // Social
  'Youtube', 'Twitch', 'Instagram', 'Facebook', 'Twitter', 'Linkedin', 'Github', 'Figma', 'Dribbble', 'Chrome', 'Chromium',
  'SunDim', 'Sun', 'Moon', 'Flashlight', 'FlashlightOff', 'Timer', 'TimerOff', 'Ratio', 'Scaling',
  'Wand', 'WandSparkles', 'Stamp', 'Sticker', 'Bubbles', 'Lasso', 'LassoSelect', 'Eraser', 'ScanHeart', 'ScanQrCode', 'Pocket', 'Spool', 'Spotlight',
  'Tickets', 'TicketsPlane', 'VenetianMask',
];

export const mediaIcons: IconCategory = { id: 'media', name: 'Media', emoji: getIcon('Image'), icons: createIconItems(ICONS) };
