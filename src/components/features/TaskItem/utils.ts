// Format minutes to human-readable string with smart display
// Display format: "2d3h5m2s" (no spaces)
export function formatMinutes(minutes: number): string {
  // Validate input
  if (!isFinite(minutes) || minutes < 0) {
    return '0s';
  }
  
  // Cap at reasonable maximum (100 days = 144000 minutes)
  const cappedMinutes = Math.min(minutes, 144000);
  const totalSeconds = Math.round(cappedMinutes * 60);
  
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  // Build display string without spaces
  const parts: string[] = [];
  
  if (days > 0) {
    parts.push(`${days}d`);
  }
  
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  
  if (mins > 0) {
    parts.push(`${mins}m`);
  }
  
  // Always show seconds if present (respect user's input precision)
  if (secs > 0) {
    parts.push(`${secs}s`);
  }
  
  // Special case: if nothing to show (truly 0), display "0s"
  if (parts.length === 0) {
    return '0s';
  }
  
  return parts.join('');
}

// Format current estimated time for display in input
export const formatEstimatedTimeForInput = (minutes?: number): string => {
  if (!minutes) return '';
  const totalSeconds = Math.round(minutes * 60);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0) parts.push(`${secs}s`);
  
  return parts.join('');
};
