/**
 * ICS Module - iCalendar parsing and generation
 * 
 * Provides standard ICS format support with NekoTick extensions.
 */

export type { NekoEvent, NekoCalendar } from './types';
export { NEKO_X_PROPS } from './types';
export { parseICS, parseMultipleICS } from './parser';
export { generateICS, generateMultipleICS } from './generator';
