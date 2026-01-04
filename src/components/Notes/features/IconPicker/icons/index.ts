export type { IconItem, IconCategory } from './types';
export { DEFAULT_ICON_COLOR } from './types';

export { commonIcons } from './common';
export { statusIcons } from './status';
export { devIcons } from './dev';
export { userIcons } from './user';
export { docIcons } from './doc';
export { mediaIcons } from './media';
export { natureIcons } from './nature';
export { placeIcons } from './place';

import { commonIcons } from './common';
import { statusIcons } from './status';
import { devIcons } from './dev';
import { userIcons } from './user';
import { docIcons } from './doc';
import { mediaIcons } from './media';
import { natureIcons } from './nature';
import { placeIcons } from './place';
import { IconCategory } from './types';

export const ICON_CATEGORIES: IconCategory[] = [
  commonIcons,
  statusIcons,
  devIcons,
  userIcons,
  docIcons,
  mediaIcons,
  natureIcons,
  placeIcons,
];

export const ICON_LIST = ICON_CATEGORIES.flatMap(cat => cat.icons);
