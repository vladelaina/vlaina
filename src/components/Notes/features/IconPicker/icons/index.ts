import { IconCategory } from './types';
import { commonIcons } from './common';
import { statusIcons } from './status';
import { devIcons } from './dev';
import { userIcons } from './user';
import { docIcons } from './doc';
import { mediaIcons } from './media';
import { natureIcons } from './nature';
import { placeIcons } from './place';

export type { IconItem, IconCategory } from './types';
export { DEFAULT_ICON_COLOR, createIconItems, getIcon } from './types';
export { commonIcons, statusIcons, devIcons, userIcons, docIcons, mediaIcons, natureIcons, placeIcons };

export const ICON_CATEGORIES: IconCategory[] = [
  commonIcons, statusIcons, devIcons, userIcons, docIcons, mediaIcons, natureIcons, placeIcons,
];

export const ICON_LIST = ICON_CATEGORIES.flatMap(cat => cat.icons);
