import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  'Eco', 'Forest', 'Grass', 'Landscape', 'Park',
  'Pets', 'CrueltyFree', 'BugReport',
  'WaterDrop', 'Water', 'Waves', 'Tsunami',
  'LocalFlorist', 'LocalOffer', 'FilterVintage', 'Yard',
  'WbSunny', 'WbCloudy', 'WbTwilight', 'Nightlight', 'DarkMode',
  'AcUnit', 'SevereCold', 'Thunderstorm', 'Air',
  'Terrain', 'Volcano', 'Hiking', 'DownhillSkiing', 'Kitesurfing'
];

export const natureIcons: IconCategory = { id: 'nature', name: 'Nature', emoji: getIcon('Eco'), icons: createIconItems(ICONS) };