import type { CalloutBlockAttrs } from './types';
import {
  getObsidianCalloutRgb,
  getObsidianCalloutType,
} from '../../theme-compatibility/obsidian/callout';
import { getTyporaAlertType } from '../../theme-compatibility/typora/callout';

export {
  getObsidianCalloutRgb,
  getObsidianCalloutType,
  getTyporaAlertType,
};

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
