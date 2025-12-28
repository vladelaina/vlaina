/**
 * 统一颜色系统 - Apple 风格
 * 
 * 这个模块是整个应用颜色系统的唯一真相来源。
 * 所有颜色相关的定义、样式、排序逻辑都从这里导出。
 * 
 * 设计原则：
 * 1. 单一真相来源 - 所有颜色定义集中在这里
 * 2. 类型安全 - 使用 TypeScript 确保颜色名称的正确性
 * 3. 易于扩展 - 添加新颜色只需修改这一个文件
 * 4. 样式生成 - 自动生成各种场景需要的样式
 */

// ============ 基础类型定义 ============

/**
 * 颜色名称类型
 * 按优先级排序：红、橙、黄、绿、蓝、紫、褐、灰
 */
export type ItemColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'brown' | 'default';

/**
 * 颜色定义接口
 */
interface ColorDefinition {
  name: ItemColor;
  hex: string;
  priority: number;
  // 深色模式下的文字颜色（某些颜色在深色背景上需要调亮）
  darkText?: string;
}

// ============ 颜色定义 ============

/**
 * 颜色定义数组 - 按优先级排序
 * 这是整个颜色系统的核心数据
 */
const COLOR_DEFINITIONS: readonly ColorDefinition[] = [
  { name: 'red',     hex: '#FE002D', priority: 0, darkText: '#FF6B6B' },
  { name: 'orange',  hex: '#FF8500', priority: 1, darkText: '#FFB366' },
  { name: 'yellow',  hex: '#FEC900', priority: 2, darkText: '#FFE066' },
  { name: 'green',   hex: '#63DA38', priority: 3, darkText: '#8AE86B' },
  { name: 'blue',    hex: '#008BFE', priority: 4, darkText: '#66B3FF' },
  { name: 'purple',  hex: '#AD46FF', priority: 5, darkText: '#C77FFF' },
  { name: 'brown',   hex: '#B47D58', priority: 6, darkText: '#D4A882' },
  { name: 'default', hex: '#9F9FA9', priority: 7, darkText: '#B8B8C0' },
] as const;

// ============ 导出的常量 ============

/**
 * 所有颜色名称数组（按优先级排序）
 */
export const ALL_COLORS: readonly ItemColor[] = COLOR_DEFINITIONS.map(c => c.name);

/**
 * 颜色 -> 十六进制值映射
 */
export const COLOR_HEX: Record<ItemColor, string> = Object.fromEntries(
  COLOR_DEFINITIONS.map(c => [c.name, c.hex])
) as Record<ItemColor, string>;

/**
 * 颜色 -> 优先级映射（用于排序）
 */
export const COLOR_PRIORITY: Record<ItemColor, number> = Object.fromEntries(
  COLOR_DEFINITIONS.map(c => [c.name, c.priority])
) as Record<ItemColor, number>;

/**
 * 颜色 -> 深色模式文字颜色映射
 */
export const COLOR_DARK_TEXT: Record<ItemColor, string> = Object.fromEntries(
  COLOR_DEFINITIONS.map(c => [c.name, c.darkText || c.hex])
) as Record<ItemColor, string>;

// ============ 工具函数 ============

/**
 * 获取颜色的十六进制值
 */
export function getColorHex(color?: ItemColor | string): string {
  return COLOR_HEX[(color as ItemColor) || 'default'] || COLOR_HEX.default;
}

/**
 * 获取颜色的优先级（用于排序）
 */
export function getColorPriority(color?: ItemColor | string): number {
  return COLOR_PRIORITY[(color as ItemColor) || 'default'] ?? COLOR_PRIORITY.default;
}

/**
 * 比较两个颜色的优先级（用于 Array.sort）
 * 返回负数表示 a 优先，正数表示 b 优先，0 表示相等
 */
export function compareColorPriority(colorA?: ItemColor | string, colorB?: ItemColor | string): number {
  return getColorPriority(colorA) - getColorPriority(colorB);
}

/**
 * 按颜色优先级排序数组
 * @param items 要排序的数组
 * @param getColor 获取颜色的函数
 */
export function sortByColorPriority<T>(
  items: T[],
  getColor: (item: T) => ItemColor | string | undefined
): T[] {
  return [...items].sort((a, b) => compareColorPriority(getColor(a), getColor(b)));
}

// ============ 样式生成 ============

/**
 * 将 hex 颜色转换为带透明度的 rgba
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 事件块的 inline 样式（用于日历事件）
 * 
 * 注意：使用 inline styles 而非 Tailwind 动态类，
 * 因为 Tailwind JIT 无法识别运行时生成的类名如 `bg-[#FE002D]/10`
 */
export interface EventInlineStyles {
  bg: string;           // 背景色 (rgba)
  bgDark: string;       // 深色模式背景色 (rgba)
  text: string;         // 文字颜色 (hex)
  textDark: string;     // 深色模式文字颜色 (hex)
  border: string;       // 边框颜色 (rgba)
  borderDark: string;   // 深色模式边框颜色 (rgba)
  ring: string;         // 聚焦环颜色 (rgba)
  ringDark: string;     // 深色模式聚焦环颜色 (rgba)
  fill: string;         // 填充颜色 (rgba) - 用于计时器进度
  fillDark: string;     // 深色模式填充颜色 (rgba)
  accent: string;       // 强调色 (hex) - 用于左侧条
}

/**
 * 生成事件块的 inline 样式
 */
function generateEventInlineStyles(def: ColorDefinition): EventInlineStyles {
  const { hex, darkText } = def;
  const textColor = darkText || hex;
  
  return {
    bg: hexToRgba(hex, 0.10),
    bgDark: hexToRgba(hex, 0.20),
    text: hex,
    textDark: textColor,
    border: hexToRgba(hex, 0.40),
    borderDark: hexToRgba(hex, 0.50),
    ring: hexToRgba(hex, 0.30),
    ringDark: hexToRgba(hex, 0.20),
    fill: hexToRgba(hex, 0.30),
    fillDark: hexToRgba(hex, 0.40),
    accent: hex,
  };
}

/**
 * 所有颜色的事件块 inline 样式
 */
export const EVENT_INLINE_STYLES: Record<ItemColor, EventInlineStyles> = Object.fromEntries(
  COLOR_DEFINITIONS.map(def => [def.name, generateEventInlineStyles(def)])
) as Record<ItemColor, EventInlineStyles>;

/**
 * 获取事件块 inline 样式
 */
export function getEventInlineStyles(color?: ItemColor | string): EventInlineStyles {
  return EVENT_INLINE_STYLES[(color as ItemColor) || 'default'] || EVENT_INLINE_STYLES.default;
}

/**
 * 全天事件的 inline 样式（比普通事件稍微深一点）
 */
export interface AllDayInlineStyles {
  bg: string;           // 背景色 (rgba)
  bgDark: string;       // 深色模式背景色 (rgba)
  text: string;         // 文字颜色 (hex)
  textDark: string;     // 深色模式文字颜色 (hex)
  border: string;       // 边框颜色 (rgba)
  borderDark: string;   // 深色模式边框颜色 (rgba)
}

/**
 * 生成全天事件的 inline 样式
 */
function generateAllDayInlineStyles(def: ColorDefinition): AllDayInlineStyles {
  const { hex, darkText } = def;
  const textColor = darkText || hex;
  
  return {
    bg: hexToRgba(hex, 0.15),
    bgDark: hexToRgba(hex, 0.25),
    text: hex,
    textDark: textColor,
    border: hexToRgba(hex, 0.50),
    borderDark: hexToRgba(hex, 0.60),
  };
}

/**
 * 所有颜色的全天事件 inline 样式
 */
export const ALL_DAY_INLINE_STYLES: Record<ItemColor, AllDayInlineStyles> = Object.fromEntries(
  COLOR_DEFINITIONS.map(def => [def.name, generateAllDayInlineStyles(def)])
) as Record<ItemColor, AllDayInlineStyles>;

/**
 * 获取全天事件 inline 样式
 */
export function getAllDayInlineStyles(color?: ItemColor | string): AllDayInlineStyles {
  return ALL_DAY_INLINE_STYLES[(color as ItemColor) || 'default'] || ALL_DAY_INLINE_STYLES.default;
}

// ============ 向后兼容的旧 API（已废弃，将在下个版本移除） ============

/**
 * @deprecated 使用 getEventInlineStyles 替代
 */
export interface EventColorStyles {
  bg: string;
  text: string;
  border: string;
  ring: string;
  fill: string;
  overtime: string;
  accent: string;
}

/**
 * @deprecated 使用 getEventInlineStyles 替代
 */
export function getEventColorStyles(_color?: ItemColor | string): EventColorStyles {
  // 返回空字符串，因为这些 Tailwind 类不会工作
  // 组件应该迁移到使用 inline styles
  return {
    bg: '',
    text: '',
    border: '',
    ring: '',
    fill: '',
    overtime: '',
    accent: '',
  };
}

/**
 * @deprecated 使用 getAllDayInlineStyles 替代
 */
export interface AllDayColorStyles {
  bg: string;
  text: string;
  border: string;
}

/**
 * @deprecated 使用 getAllDayInlineStyles 替代
 */
export function getAllDayColorStyles(_color?: ItemColor | string): AllDayColorStyles {
  // 返回空字符串，因为这些 Tailwind 类不会工作
  return {
    bg: '',
    text: '',
    border: '',
  };
}

/**
 * 获取简单颜色的 hex 值（用于颜色选择器、复选框边框等）
 */
export function getSimpleColorHex(color?: ItemColor | string): string {
  return COLOR_HEX[(color as ItemColor) || 'default'] || COLOR_HEX.default;
}

/**
 * 简单颜色样式（用于颜色选择器等需要背景色的场景）
 * 使用 hex 值而非 Tailwind 类，因为动态类不会被编译
 */
export interface SimpleColorStyles {
  hex: string;
}

/**
 * 所有颜色的简单样式
 */
export const SIMPLE_COLOR_STYLES: Record<ItemColor, SimpleColorStyles> = Object.fromEntries(
  COLOR_DEFINITIONS.map(def => [def.name, { hex: def.hex }])
) as Record<ItemColor, SimpleColorStyles>;

// ============ 颜色选择器数据 ============

/**
 * 颜色选择器选项
 */
export interface ColorOption {
  name: ItemColor;
  hex: string;
  label: string;
}

/**
 * 颜色选择器选项数组
 */
export const COLOR_PICKER_OPTIONS: readonly ColorOption[] = COLOR_DEFINITIONS.map(def => ({
  name: def.name,
  hex: def.hex,
  label: def.name === 'default' ? 'Default' : def.name.charAt(0).toUpperCase() + def.name.slice(1),
}));

// ============ 渐变色（用于"全选"按钮等） ============

/**
 * 彩虹渐变色（用于颜色过滤器的"全选"按钮）
 */
export const RAINBOW_GRADIENT = `linear-gradient(135deg, ${COLOR_DEFINITIONS.slice(0, 6).map(c => c.hex).join(', ')})`;

// ============ 右键菜单颜色选择器 ============

/**
 * 右键菜单颜色选项（使用 hex 值而非 Tailwind 类）
 */
export interface ContextMenuColorOption {
  name: ItemColor;
  hex: string;
}

/**
 * 右键菜单颜色选项数组
 */
export const CONTEXT_MENU_COLORS: readonly ContextMenuColorOption[] = COLOR_DEFINITIONS.map(def => ({
  name: def.name,
  hex: def.hex,
}));

// ============ 默认颜色 ============

/**
 * 默认颜色名称
 */
export const DEFAULT_COLOR: ItemColor = 'default';

/**
 * 检查颜色是否为默认颜色
 */
export function isDefaultColor(color?: ItemColor | string): boolean {
  return !color || color === 'default';
}

/**
 * 获取有效颜色（如果为空则返回默认颜色）
 */
export function getValidColor(color?: ItemColor | string): ItemColor {
  if (!color || !(color in COLOR_HEX)) {
    return 'default';
  }
  return color as ItemColor;
}


