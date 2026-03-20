export function detectSystemTimezone(): number {
  try {
    const offsetMinutes = -new Date().getTimezoneOffset();
    const offsetHours = offsetMinutes / 60;
    const roundedOffset = Math.round(offsetHours * 4) / 4;

    return roundedOffset;
  } catch (error) {
    console.error('Failed to detect system timezone:', error);
    return 8;
  }
}

export function getSystemTimezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return 'Unknown';
  }
}
