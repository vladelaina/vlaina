// Unified Color System - Apple style

export type ItemColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'brown' | 'default';

interface ColorDefinition {
  name: ItemColor;
  hex: string;
  priority: number;
  darkText?: string;
}

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

export const ALL_COLORS: readonly ItemColor[] = COLOR_DEFINITIONS.map(c => c.name);

export const COLOR_HEX: Record<ItemColor, string> = Object.fromEntries(
  COLOR_DEFINITIONS.map(c => [c.name, c.hex])
) as Record<ItemColor, string>;

export const COLOR_PRIORITY: Record<ItemColor, number> = Object.fromEntries(
  COLOR_DEFINITIONS.map(c => [c.name, c.priority])
) as Record<ItemColor, number>;

export const COLOR_DARK_TEXT: Record<ItemColor, string> = Object.fromEntries(
  COLOR_DEFINITIONS.map(c => [c.name, c.darkText || c.hex])
) as Record<ItemColor, string>;

export function getColorHex(color?: ItemColor | string): string {
  return COLOR_HEX[(color as ItemColor) || 'default'] || COLOR_HEX.default;
}

export function getColorPriority(color?: ItemColor | string): number {
  return COLOR_PRIORITY[(color as ItemColor) || 'default'] ?? COLOR_PRIORITY.default;
}

export function compareColorPriority(colorA?: ItemColor | string, colorB?: ItemColor | string): number {
  return getColorPriority(colorA) - getColorPriority(colorB);
}

export function sortByColorPriority<T>(
  items: T[],
  getColor: (item: T) => ItemColor | string | undefined
): T[] {
  return [...items].sort((a, b) => compareColorPriority(getColor(a), getColor(b)));
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface EventInlineStyles {
  bg: string;
  bgDark: string;
  text: string;
  textDark: string;
  border: string;
  borderDark: string;
  ring: string;
  ringDark: string;
  fill: string;
  fillDark: string;
  accent: string;
}

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

export const EVENT_INLINE_STYLES: Record<ItemColor, EventInlineStyles> = Object.fromEntries(
  COLOR_DEFINITIONS.map(def => [def.name, generateEventInlineStyles(def)])
) as Record<ItemColor, EventInlineStyles>;

export function getEventInlineStyles(color?: ItemColor | string): EventInlineStyles {
  return EVENT_INLINE_STYLES[(color as ItemColor) || 'default'] || EVENT_INLINE_STYLES.default;
}

export interface AllDayInlineStyles {
  bg: string;
  bgDark: string;
  text: string;
  textDark: string;
  border: string;
  borderDark: string;
}

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

export const ALL_DAY_INLINE_STYLES: Record<ItemColor, AllDayInlineStyles> = Object.fromEntries(
  COLOR_DEFINITIONS.map(def => [def.name, generateAllDayInlineStyles(def)])
) as Record<ItemColor, AllDayInlineStyles>;

export function getAllDayInlineStyles(color?: ItemColor | string): AllDayInlineStyles {
  return ALL_DAY_INLINE_STYLES[(color as ItemColor) || 'default'] || ALL_DAY_INLINE_STYLES.default;
}

/** @deprecated Use getEventInlineStyles instead */
export interface EventColorStyles {
  bg: string;
  text: string;
  border: string;
  ring: string;
  fill: string;
  overtime: string;
  accent: string;
}

/** @deprecated Use getEventInlineStyles instead */
export function getEventColorStyles(_color?: ItemColor | string): EventColorStyles {
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

/** @deprecated Use getAllDayInlineStyles instead */
export interface AllDayColorStyles {
  bg: string;
  text: string;
  border: string;
}

/** @deprecated Use getAllDayInlineStyles instead */
export function getAllDayColorStyles(_color?: ItemColor | string): AllDayColorStyles {
  return {
    bg: '',
    text: '',
    border: '',
  };
}

export function getSimpleColorHex(color?: ItemColor | string): string {
  return COLOR_HEX[(color as ItemColor) || 'default'] || COLOR_HEX.default;
}

export interface SimpleColorStyles {
  hex: string;
}

export const SIMPLE_COLOR_STYLES: Record<ItemColor, SimpleColorStyles> = Object.fromEntries(
  COLOR_DEFINITIONS.map(def => [def.name, { hex: def.hex }])
) as Record<ItemColor, SimpleColorStyles>;

export interface ColorOption {
  name: ItemColor;
  hex: string;
  label: string;
}

export const COLOR_PICKER_OPTIONS: readonly ColorOption[] = COLOR_DEFINITIONS.map(def => ({
  name: def.name,
  hex: def.hex,
  label: def.name === 'default' ? 'Default' : def.name.charAt(0).toUpperCase() + def.name.slice(1),
}));

export const RAINBOW_GRADIENT = `linear-gradient(135deg, ${COLOR_DEFINITIONS.slice(0, 6).map(c => c.hex).join(', ')})`;

export interface ContextMenuColorOption {
  name: ItemColor;
  hex: string;
}

export const CONTEXT_MENU_COLORS: readonly ContextMenuColorOption[] = COLOR_DEFINITIONS.map(def => ({
  name: def.name,
  hex: def.hex,
}));

export const DEFAULT_COLOR: ItemColor = 'default';

export function isDefaultColor(color?: ItemColor | string): boolean {
  return !color || color === 'default';
}

export function getValidColor(color?: ItemColor | string): ItemColor {
  if (!color || !(color in COLOR_HEX)) {
    return 'default';
  }
  return color as ItemColor;
}


