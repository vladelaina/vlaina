import type { CalloutBlockAttrs } from './types';

const OBSIDIAN_CALLOUT_BY_COLOR: Record<string, string> = {
  yellow: 'warning',
  blue: 'info',
  green: 'success',
  red: 'danger',
  purple: 'example',
  gray: 'quote',
};

const OBSIDIAN_CALLOUT_RGB_BY_COLOR: Record<string, string> = {
  yellow: '245, 158, 11',
  blue: '59, 130, 246',
  green: '34, 197, 94',
  red: '239, 68, 68',
  purple: '168, 85, 247',
  gray: '107, 114, 128',
};

const TYPORA_ALERT_BY_COLOR: Record<string, string> = {
  yellow: 'warning',
  blue: 'note',
  green: 'tip',
  red: 'caution',
  purple: 'important',
  gray: 'note',
};

export function getObsidianCalloutType(backgroundColor: unknown): string {
  const key = typeof backgroundColor === 'string' ? backgroundColor : '';
  return OBSIDIAN_CALLOUT_BY_COLOR[key] ?? 'note';
}

export function getObsidianCalloutRgb(backgroundColor: unknown): string {
  const key = typeof backgroundColor === 'string' ? backgroundColor : '';
  return OBSIDIAN_CALLOUT_RGB_BY_COLOR[key] ?? '59, 130, 246';
}

export function getTyporaAlertType(backgroundColor: unknown): string {
  const key = typeof backgroundColor === 'string' ? backgroundColor : '';
  return TYPORA_ALERT_BY_COLOR[key] ?? 'note';
}

export function getCalloutCompatibilityClassName(backgroundColor: unknown): string {
  const color = typeof backgroundColor === 'string' && backgroundColor ? backgroundColor : 'yellow';
  const alertType = getTyporaAlertType(color);
  return [
    'callout',
    `callout-${color}`,
    'md-alert',
    `md-alert-${alertType}`,
  ].join(' ');
}

export function getCalloutTitleCompatibilityClassName(backgroundColor: unknown): string {
  const alertType = getTyporaAlertType(backgroundColor);
  return [
    'callout-title',
    'md-alert-text-container',
    'md-alert-text',
    `md-alert-text-${alertType}`,
  ].join(' ');
}

export function getCalloutCompatibilityAttrs(attrs: CalloutBlockAttrs): Record<string, string> {
  return {
    'data-callout': getObsidianCalloutType(attrs.backgroundColor),
    'data-callout-metadata': '',
    style: `--callout-color: ${getObsidianCalloutRgb(attrs.backgroundColor)};`,
  };
}
