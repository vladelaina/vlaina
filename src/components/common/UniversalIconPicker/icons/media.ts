import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  'Image', 'Collections', 'PhotoCamera', 'CameraAlt', 'Camera',
  'Movie', 'MovieCreation', 'VideoCameraBack', 'Videocam',
  'MusicNote', 'MusicVideo', 'LibraryMusic', 'Album',
  'VolumeUp', 'VolumeOff', 'Mic', 'MicOff',
  'PlayArrow', 'Pause', 'Stop', 'SkipNext', 'SkipPrevious',
  'FastForward', 'FastRewind', 'Replay', 'Repeat', 'Shuffle',
  'Headphones', 'Speaker', 'Radio', 'Tv',
  'Brush', 'ColorLens', 'FormatPaint', 'AutoFixHigh'
];

export const mediaIcons: IconCategory = { id: 'media', name: 'Media', emoji: getIcon('Image'), icons: createIconItems(ICONS) };