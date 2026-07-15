const CALLOUT_TYPE_BY_COLOR: Record<string, string> = {
  yellow: 'warning',
  blue: 'info',
  green: 'success',
  red: 'danger',
  purple: 'example',
  gray: 'quote',
};

const CALLOUT_RGB_BY_COLOR: Record<string, string> = {
  yellow: '245, 158, 11',
  blue: '59, 130, 246',
  green: '34, 197, 94',
  red: '239, 68, 68',
  purple: '168, 85, 247',
  gray: '107, 114, 128',
};

export function getObsidianCalloutType(backgroundColor: unknown): string {
  const key = typeof backgroundColor === 'string' ? backgroundColor : '';
  return CALLOUT_TYPE_BY_COLOR[key] ?? 'note';
}

export function getObsidianCalloutRgb(backgroundColor: unknown): string {
  const key = typeof backgroundColor === 'string' ? backgroundColor : '';
  return CALLOUT_RGB_BY_COLOR[key] ?? '59, 130, 246';
}
