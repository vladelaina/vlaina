// 类型导出
export type { IconItem, IconCategory } from './types';
export { DEFAULT_ICON_COLOR } from './types';

// 8个分类导出
export { commonIcons } from './common';
export { statusIcons } from './status';
export { devIcons } from './dev';
export { userIcons } from './user';
export { docIcons } from './doc';
export { mediaIcons } from './media';
export { natureIcons } from './nature';
export { placeIcons } from './place';

// 导入所有分类
import { commonIcons } from './common';
import { statusIcons } from './status';
import { devIcons } from './dev';
import { userIcons } from './user';
import { docIcons } from './doc';
import { mediaIcons } from './media';
import { natureIcons } from './nature';
import { placeIcons } from './place';
import { IconCategory } from './types';

// 所有分类数组 (8个分类)
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

// 扁平化的图标列表（兼容 NoteIcon.tsx）
export const ICON_LIST = ICON_CATEGORIES.flatMap(cat => cat.icons);
