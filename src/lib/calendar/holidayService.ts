/**
 * Holiday Service - Handles fetching holiday data from Google Calendar
 */

export interface HolidayRegion {
  id: string;
  name: string;
  flag: string;
  lang: string;
  region: string;
}

/**
 * Curated list of popular holiday regions supported by Google
 */
export const HOLIDAY_REGIONS: HolidayRegion[] = [
  { id: 'cn', name: 'China', flag: '🇨🇳', lang: 'zh_cn', region: 'china' },
  { id: 'us', name: 'United States', flag: '🇺🇸', lang: 'en', region: 'usa' },
  { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', lang: 'en', region: 'uk' },
  { id: 'jp', name: 'Japan', flag: '🇯🇵', lang: 'ja', region: 'japanese' },
  { id: 'de', name: 'Germany', flag: '🇩🇪', lang: 'en', region: 'german' },
  { id: 'fr', name: 'France', flag: '🇫🇷', lang: 'en', region: 'french' },
  { id: 'ca', name: 'Canada', flag: '🇨🇦', lang: 'en', region: 'canadian' },
  { id: 'au', name: 'Australia', flag: '🇦🇺', lang: 'en', region: 'australian' },
  { id: 'hk', name: 'Hong Kong', flag: '🇭🇰', lang: 'zh_cn', region: 'hong_kong' },
  { id: 'tw', name: 'Taiwan', flag: '🇹🇼', lang: 'zh_cn', region: 'taiwan' },
  { id: 'kr', name: 'South Korea', flag: '🇰🇷', lang: 'en', region: 'south_korea' },
];

/**
 * Generate the Google Public ICS URL for a region
 */
export function getGoogleHolidayUrl(region: HolidayRegion): string {
  // Format: https://calendar.google.com/calendar/ical/{lang}.{region}%23holiday@group.v.calendar.google.com/public/basic.ics
  return `https://calendar.google.com/calendar/ical/${region.lang}.${region.region}%23holiday@group.v.calendar.google.com/public/basic.ics`;
}

/**
 * Fetch holiday ICS data
 */
export async function fetchHolidayICS(url: string): Promise<string | null> {
  try {
    let fetchUrl = url;
    
    // Only use proxy for Google Calendar URLs
    if (url.includes('calendar.google.com')) {
        fetchUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    }
    
    const response = await fetch(fetchUrl);
    
    if (!response.ok) {
        throw new Error(`Status: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    return text;
  } catch (error) {
    return null;
  }
}
