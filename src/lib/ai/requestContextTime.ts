export function formatTimeByOffset(offset: number, now = new Date()): string {
  const utcMs = now.getTime();
  const totalOffsetMinutes = Math.round(offset * 60);
  const targetMs = utcMs + totalOffsetMinutes * 60 * 1000;
  const targetDate = new Date(targetMs);

  const year = targetDate.getUTCFullYear();
  const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getUTCDate()).padStart(2, '0');
  const hours = String(targetDate.getUTCHours()).padStart(2, '0');
  const minutes = String(targetDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(targetDate.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
