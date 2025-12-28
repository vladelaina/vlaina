/**
 * Calendar Constants - 日历相关常量
 * 
 * 这个模块是日历配置常量的唯一真相来源。
 * 
 * 设计原则：
 * 1. 单一真相来源 - 所有日历常量集中在这里
 * 2. 易于修改 - 调整默认值只需改一处
 * 3. 类型安全 - 使用 TypeScript 确保正确性
 */

// ============ 默认事件时长 ============

/**
 * 默认事件时长（分钟）
 * 
 * 用于以下场景：
 * - 拖拽任务到日历创建事件
 * - 计时器启动时计算结束时间
 * - 日历显示没有 endDate 的任务
 * 
 * 25 分钟 = 番茄钟风格，适合专注工作
 */
export const DEFAULT_EVENT_DURATION_MINUTES = 25;

/**
 * 默认事件时长（毫秒）
 * 
 * 便于直接用于时间戳计算：
 * endDate = startDate + DEFAULT_EVENT_DURATION_MS
 */
export const DEFAULT_EVENT_DURATION_MS = DEFAULT_EVENT_DURATION_MINUTES * 60 * 1000;
