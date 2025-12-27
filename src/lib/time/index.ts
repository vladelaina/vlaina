/**
 * 统一时间系统模块
 * 
 * 这个模块是整个应用时间相关功能的唯一真相来源。
 * 包含两类时间处理：
 * 1. 时长（Duration）- 如 "2h30m"，用于任务预估时间
 * 2. 时钟时间（ClockTime）- 如 "14:30"，用于日历事件
 * 
 * 设计原则：
 * 1. 单一真相来源 - 所有时间解析/格式化集中在这里
 * 2. 类型安全 - 使用 TypeScript 确保类型正确
 * 3. 清晰命名 - 不同功能使用不同函数名，避免混淆
 */

// ============ 时长相关 ============

export {
  parseDuration,
  formatDuration,
  formatDurationFull,
  extractDuration,
  type DurationFormatOptions,
  type ExtractDurationResult,
} from './duration';

// ============ 时钟时间相关 ============

export {
  parseClockTime,
  formatClockTime,
  clockTimeToMinutes,
  minutesToClockTime,
  type ClockTime,
} from './clockTime';
