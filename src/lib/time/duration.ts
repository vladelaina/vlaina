/**
 * 时长解析和格式化模块
 * 
 * 处理时长字符串（如 "2h30m", "1d3h", "45s"）的解析和格式化。
 * 时长在内部统一使用分钟数表示。
 */

// ============ 类型定义 ============

/**
 * 时长格式化选项
 */
export interface DurationFormatOptions {
  /** 是否显示天数，默认根据时长自动判断 */
  showDays?: boolean;
  /** 是否显示秒数，默认 false */
  showSeconds?: boolean;
}

/**
 * 时长提取结果
 */
export interface ExtractDurationResult {
  /** 清理后的内容（移除时长部分） */
  cleanContent: string;
  /** 提取的分钟数，未找到时长则为 undefined */
  minutes?: number;
}

// ============ 常量 ============

/** 最大支持的分钟数（100天） */
const MAX_MINUTES = 144000;

/** 每天的分钟数 */
const MINUTES_PER_DAY = 1440;

/** 每小时的分钟数 */
const MINUTES_PER_HOUR = 60;

// ============ 解析函数 ============

/**
 * 解析时长字符串为分钟数
 * 
 * 支持格式:
 * - 单位: "2h", "30m", "45s", "1d"
 * - 复合: "2h30m", "1d3h5m", "2d3h5m2s"
 * - 小数: "1.5h", "2.5d"
 * 
 * @param input - 时长字符串
 * @returns 分钟数，无效输入返回 undefined
 * 
 * @example
 * parseDuration("2h30m") // 150
 * parseDuration("1.5h")  // 90
 * parseDuration("45s")   // 0.75
 * parseDuration("invalid") // undefined
 */
export function parseDuration(input: string): number | undefined {
  if (!input || typeof input !== 'string') {
    return undefined;
  }

  const str = input.trim().toLowerCase();
  if (!str) {
    return undefined;
  }

  // 匹配模式: 可选的天、小时、分钟、秒，支持小数
  const pattern = /^(?:(\d+(?:\.\d+)?)d)?(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i;
  const match = str.match(pattern);

  // 必须匹配且不能是空字符串
  if (!match || !match[0].trim()) {
    return undefined;
  }

  const days = match[1] ? parseFloat(match[1]) : 0;
  const hours = match[2] ? parseFloat(match[2]) : 0;
  const minutes = match[3] ? parseFloat(match[3]) : 0;
  const seconds = match[4] ? parseFloat(match[4]) : 0;

  // 验证所有数值都是有限的正数
  if (!isFinite(days) || !isFinite(hours) || !isFinite(minutes) || !isFinite(seconds) ||
      days < 0 || hours < 0 || minutes < 0 || seconds < 0) {
    return undefined;
  }

  // 计算总分钟数（包含秒的小数部分）
  const totalMinutes = days * MINUTES_PER_DAY + hours * MINUTES_PER_HOUR + minutes + seconds / 60;

  // 验证结果在合理范围内（大于0且不超过100天）
  if (totalMinutes <= 0 || totalMinutes >= MAX_MINUTES) {
    return undefined;
  }

  return totalMinutes;
}

// ============ 格式化函数 ============

/**
 * 格式化分钟数为时长字符串
 * 
 * @param minutes - 分钟数
 * @param options - 格式化选项
 * @returns 格式化的时长字符串
 * 
 * @example
 * formatDuration(150)                          // "2h30m"
 * formatDuration(45)                           // "45m"
 * formatDuration(120)                          // "2h"
 * formatDuration(1500, { showDays: true })     // "1d1h"
 * formatDuration(90.5, { showSeconds: true })  // "1h30m30s"
 */
export function formatDuration(minutes: number, options: DurationFormatOptions = {}): string {
  // 处理无效输入
  if (!isFinite(minutes) || minutes < 0) {
    return '0m';
  }

  const { showDays = false, showSeconds = false } = options;

  // 限制最大值
  const cappedMinutes = Math.min(minutes, MAX_MINUTES);

  // 转换为秒以保持精度
  const totalSeconds = Math.round(cappedMinutes * 60);

  // 计算各单位
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts: string[] = [];

  // 根据选项决定是否显示天数
  if (showDays && days > 0) {
    parts.push(`${days}d`);
  } else if (!showDays && days > 0) {
    // 不显示天数时，将天数转换为小时
    const totalHours = days * 24 + hours;
    if (totalHours > 0) parts.push(`${totalHours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (showSeconds && secs > 0) parts.push(`${secs}s`);
    return parts.length === 0 ? '0m' : parts.join('');
  }

  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (showSeconds && secs > 0) parts.push(`${secs}s`);

  return parts.length === 0 ? '0m' : parts.join('');
}

/**
 * 格式化分钟数为完整时长字符串（包含天、时、分、秒）
 * 
 * @param minutes - 分钟数
 * @returns 格式化的时长字符串
 * 
 * @example
 * formatDurationFull(1500.5) // "1d1h0m30s"
 * formatDurationFull(90)     // "1h30m"
 */
export function formatDurationFull(minutes: number): string {
  if (!isFinite(minutes) || minutes < 0) {
    return '0s';
  }

  const cappedMinutes = Math.min(minutes, MAX_MINUTES);
  const totalSeconds = Math.round(cappedMinutes * 60);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.length === 0 ? '0s' : parts.join('');
}

// ============ 提取函数 ============

/**
 * 从任务内容末尾提取时长
 * 
 * 在任务内容末尾查找时长模式（如 "2h", "30m", "1h30m"），
 * 如果找到则返回清理后的内容和提取的分钟数。
 * 
 * @param content - 任务内容
 * @returns 清理后的内容和提取的分钟数
 * 
 * @example
 * extractDuration("完成报告 2h")     // { cleanContent: "完成报告", minutes: 120 }
 * extractDuration("开会 1h30m")      // { cleanContent: "开会", minutes: 90 }
 * extractDuration("开会")            // { cleanContent: "开会", minutes: undefined }
 * extractDuration("2h")              // { cleanContent: "2h", minutes: undefined } // 不提取纯时长
 */
export function extractDuration(content: string): ExtractDurationResult {
  if (!content || typeof content !== 'string') {
    return { cleanContent: content || '' };
  }

  // 匹配末尾的时长模式（前面必须有空格）
  const pattern = /\s+(?:(\d+(?:\.\d+)?)d)?(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i;
  const match = content.match(pattern);

  if (match && match[0].trim()) {
    const timeStr = match[0].trim();
    const minutes = parseDuration(timeStr);

    if (minutes !== undefined) {
      const cleanContent = content.replace(match[0], '').trim();
      
      // 不允许内容被完全清空
      if (cleanContent.length === 0) {
        return { cleanContent: content };
      }
      
      return { cleanContent, minutes };
    }
  }

  return { cleanContent: content };
}


