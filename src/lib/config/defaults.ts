/**
 * Application Default Configuration
 * 
 * 这个模块是所有应用默认配置的唯一真相来源。
 * 
 * 设计原则：
 * 1. 单一真相来源 - 所有默认值集中在这里
 * 2. 易于修改 - 调整默认值只需改一处
 * 3. 类型安全 - 使用 TypeScript 确保正确性
 */

import type { TimeView } from '@/lib/date';

// ============ Settings Defaults ============

/** 默认时区 (UTC+8) */
export const DEFAULT_TIMEZONE = 8;

/** 默认视图模式 */
export const DEFAULT_VIEW_MODE: TimeView = 'day';

/** 默认显示天数 */
export const DEFAULT_DAY_COUNT = 1;

/** 默认小时高度 (px) */
export const DEFAULT_HOUR_HEIGHT = 64;

/** 默认是否使用24小时制 */
export const DEFAULT_USE_24_HOUR = false;

/** 默认日开始时间 (分钟，5:00 AM = 300) */
export const DEFAULT_DAY_START_TIME = 300;

// ============ Group Defaults ============

/** 默认分组 ID */
export const DEFAULT_GROUP_ID = 'default';

/** 默认分组名称 */
export const DEFAULT_GROUP_NAME = 'Inbox';

// ============ Storage Keys ============

/** localStorage key: 颜色过滤器 */
export const STORAGE_KEY_COLOR_FILTER = 'nekotick-color-filter';

/** localStorage key: 状态过滤器 */
export const STORAGE_KEY_STATUS_FILTER = 'nekotick-status-filter';

/** localStorage key: 快捷键配置 */
export const STORAGE_KEY_SHORTCUTS = 'nekotick-shortcuts';

/** localStorage key: 待同步标记 */
export const STORAGE_KEY_PENDING_SYNC = 'pendingSync';

/** localStorage key: 字体大小 */
export const STORAGE_KEY_FONT_SIZE = 'fontSize';

/** localStorage key: 自动更新 */
export const STORAGE_KEY_AUTO_UPDATE = 'autoUpdate';

// ============ Aggregated Defaults ============

/**
 * 默认 Settings 配置对象
 * 用于初始化和 fallback
 */
export const DEFAULT_SETTINGS = {
  timezone: DEFAULT_TIMEZONE,
  viewMode: DEFAULT_VIEW_MODE,
  dayCount: DEFAULT_DAY_COUNT,
  hourHeight: DEFAULT_HOUR_HEIGHT,
  use24Hour: DEFAULT_USE_24_HOUR,
  dayStartTime: DEFAULT_DAY_START_TIME,
} as const;
