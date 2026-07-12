const ALERT_TYPE_BY_COLOR: Record<string, string> = {
  yellow: 'warning',
  blue: 'note',
  green: 'tip',
  red: 'caution',
  purple: 'important',
  gray: 'note',
};

export function getTyporaAlertType(backgroundColor: unknown): string {
  const key = typeof backgroundColor === 'string' ? backgroundColor : '';
  return ALERT_TYPE_BY_COLOR[key] ?? 'note';
}
