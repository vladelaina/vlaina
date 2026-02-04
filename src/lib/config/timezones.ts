// 完整的时区列表
export interface TimezoneInfo {
  offset: number;
  name: string;
  city: string;
  region: string;
}

export const TIMEZONES: TimezoneInfo[] = [
  // UTC-12 to UTC-11
  { offset: -12, name: 'Baker Island Time', city: 'Baker Island', region: 'Pacific' },
  { offset: -11, name: 'Samoa Standard Time', city: 'Pago Pago', region: 'Pacific' },
  
  // UTC-10
  { offset: -10, name: 'Hawaii-Aleutian Standard Time', city: 'Honolulu', region: 'Pacific' },
  
  // UTC-9
  { offset: -9, name: 'Alaska Standard Time', city: 'Anchorage', region: 'America' },
  
  // UTC-8
  { offset: -8, name: 'Pacific Standard Time', city: 'Los Angeles', region: 'America' },
  { offset: -8, name: 'Pacific Standard Time', city: 'San Francisco', region: 'America' },
  { offset: -8, name: 'Pacific Standard Time', city: 'Seattle', region: 'America' },
  { offset: -8, name: 'Pacific Standard Time', city: 'Vancouver', region: 'America' },
  
  // UTC-7
  { offset: -7, name: 'Mountain Standard Time', city: 'Denver', region: 'America' },
  { offset: -7, name: 'Mountain Standard Time', city: 'Phoenix', region: 'America' },
  { offset: -7, name: 'Mountain Standard Time', city: 'Calgary', region: 'America' },
  
  // UTC-6
  { offset: -6, name: 'Central Standard Time', city: 'Chicago', region: 'America' },
  { offset: -6, name: 'Central Standard Time', city: 'Mexico City', region: 'America' },
  { offset: -6, name: 'Central Standard Time', city: 'Dallas', region: 'America' },
  { offset: -6, name: 'Central Standard Time', city: 'Houston', region: 'America' },
  
  // UTC-5
  { offset: -5, name: 'Eastern Standard Time', city: 'New York', region: 'America' },
  { offset: -5, name: 'Eastern Standard Time', city: 'Toronto', region: 'America' },
  { offset: -5, name: 'Colombia Time', city: 'Bogotá', region: 'America' },
  { offset: -5, name: 'Peru Time', city: 'Lima', region: 'America' },
  
  // UTC-4
  { offset: -4, name: 'Atlantic Standard Time', city: 'Halifax', region: 'America' },
  { offset: -4, name: 'Venezuela Time', city: 'Caracas', region: 'America' },
  { offset: -4, name: 'Chile Standard Time', city: 'Santiago', region: 'America' },
  
  // UTC-3
  { offset: -3, name: 'Argentina Time', city: 'Buenos Aires', region: 'America' },
  { offset: -3, name: 'Brasília Time', city: 'São Paulo', region: 'America' },
  { offset: -3, name: 'Brasília Time', city: 'Rio de Janeiro', region: 'America' },
  { offset: -3, name: 'Uruguay Time', city: 'Montevideo', region: 'America' },
  
  // UTC-3.5
  { offset: -3.5, name: 'Newfoundland Standard Time', city: 'St. John\'s', region: 'America' },
  
  // UTC-2
  { offset: -2, name: 'South Georgia Time', city: 'South Georgia', region: 'Atlantic' },
  
  // UTC-1
  { offset: -1, name: 'Azores Time', city: 'Azores', region: 'Atlantic' },
  { offset: -1, name: 'Cape Verde Time', city: 'Praia', region: 'Atlantic' },
  
  // UTC+0
  { offset: 0, name: 'Greenwich Mean Time', city: 'London', region: 'Europe' },
  { offset: 0, name: 'Western European Time', city: 'Lisbon', region: 'Europe' },
  { offset: 0, name: 'Western European Time', city: 'Dublin', region: 'Europe' },
  { offset: 0, name: 'West Africa Time', city: 'Accra', region: 'Africa' },
  { offset: 0, name: 'West Africa Time', city: 'Dakar', region: 'Africa' },
  
  // UTC+1
  { offset: 1, name: 'Central European Time', city: 'Paris', region: 'Europe' },
  { offset: 1, name: 'Central European Time', city: 'Berlin', region: 'Europe' },
  { offset: 1, name: 'Central European Time', city: 'Rome', region: 'Europe' },
  { offset: 1, name: 'Central European Time', city: 'Madrid', region: 'Europe' },
  { offset: 1, name: 'Central European Time', city: 'Amsterdam', region: 'Europe' },
  { offset: 1, name: 'West Africa Time', city: 'Lagos', region: 'Africa' },
  
  // UTC+2
  { offset: 2, name: 'Eastern European Time', city: 'Athens', region: 'Europe' },
  { offset: 2, name: 'Eastern European Time', city: 'Helsinki', region: 'Europe' },
  { offset: 2, name: 'Eastern European Time', city: 'Cairo', region: 'Africa' },
  { offset: 2, name: 'South Africa Standard Time', city: 'Johannesburg', region: 'Africa' },
  { offset: 2, name: 'Israel Standard Time', city: 'Jerusalem', region: 'Asia' },
  { offset: 2, name: 'Eastern European Time', city: 'Bucharest', region: 'Europe' },
  
  // UTC+3
  { offset: 3, name: 'Moscow Standard Time', city: 'Moscow', region: 'Europe' },
  { offset: 3, name: 'East Africa Time', city: 'Nairobi', region: 'Africa' },
  { offset: 3, name: 'Arabia Standard Time', city: 'Riyadh', region: 'Asia' },
  { offset: 3, name: 'Turkey Time', city: 'Istanbul', region: 'Europe' },
  
  // UTC+3.5
  { offset: 3.5, name: 'Iran Standard Time', city: 'Tehran', region: 'Asia' },
  
  // UTC+4
  { offset: 4, name: 'Gulf Standard Time', city: 'Dubai', region: 'Asia' },
  { offset: 4, name: 'Gulf Standard Time', city: 'Abu Dhabi', region: 'Asia' },
  { offset: 4, name: 'Azerbaijan Time', city: 'Baku', region: 'Asia' },
  { offset: 4, name: 'Georgia Standard Time', city: 'Tbilisi', region: 'Asia' },
  { offset: 4, name: 'Armenia Time', city: 'Yerevan', region: 'Asia' },
  
  // UTC+4.5
  { offset: 4.5, name: 'Afghanistan Time', city: 'Kabul', region: 'Asia' },
  
  // UTC+5
  { offset: 5, name: 'Pakistan Standard Time', city: 'Karachi', region: 'Asia' },
  { offset: 5, name: 'Uzbekistan Time', city: 'Tashkent', region: 'Asia' },
  
  // UTC+5.5
  { offset: 5.5, name: 'India Standard Time', city: 'Mumbai', region: 'Asia' },
  { offset: 5.5, name: 'India Standard Time', city: 'New Delhi', region: 'Asia' },
  { offset: 5.5, name: 'Sri Lanka Time', city: 'Colombo', region: 'Asia' },
  
  // UTC+5.75
  { offset: 5.75, name: 'Nepal Time', city: 'Kathmandu', region: 'Asia' },
  
  // UTC+6
  { offset: 6, name: 'Bangladesh Standard Time', city: 'Dhaka', region: 'Asia' },
  { offset: 6, name: 'Kyrgyzstan Time', city: 'Bishkek', region: 'Asia' },
  
  // UTC+6.5
  { offset: 6.5, name: 'Myanmar Time', city: 'Yangon', region: 'Asia' },
  
  // UTC+7
  { offset: 7, name: 'Indochina Time', city: 'Bangkok', region: 'Asia' },
  { offset: 7, name: 'Indochina Time', city: 'Hanoi', region: 'Asia' },
  { offset: 7, name: 'Indochina Time', city: 'Ho Chi Minh City', region: 'Asia' },
  { offset: 7, name: 'Western Indonesian Time', city: 'Jakarta', region: 'Asia' },
  
  // UTC+8
  { offset: 8, name: 'China Standard Time', city: 'Beijing', region: 'Asia' },
  { offset: 8, name: 'China Standard Time', city: 'Shanghai', region: 'Asia' },
  { offset: 8, name: 'China Standard Time', city: 'Shenzhen', region: 'Asia' },
  { offset: 8, name: 'China Standard Time', city: 'Guangzhou', region: 'Asia' },
  { offset: 8, name: 'Hong Kong Time', city: 'Hong Kong', region: 'Asia' },
  { offset: 8, name: 'Macau Time', city: 'Macau', region: 'Asia' },
  { offset: 8, name: 'Singapore Time', city: 'Singapore', region: 'Asia' },
  { offset: 8, name: 'Philippine Time', city: 'Manila', region: 'Asia' },
  { offset: 8, name: 'Australian Western Standard Time', city: 'Perth', region: 'Australia' },
  { offset: 8, name: 'Taipei Standard Time', city: 'Taipei', region: 'Asia' },
  { offset: 8, name: 'Malaysia Time', city: 'Kuala Lumpur', region: 'Asia' },
  
  // UTC+8.75
  { offset: 8.75, name: 'Australian Central Western Standard Time', city: 'Eucla', region: 'Australia' },
  
  // UTC+9
  { offset: 9, name: 'Japan Standard Time', city: 'Tokyo', region: 'Asia' },
  { offset: 9, name: 'Korea Standard Time', city: 'Seoul', region: 'Asia' },
  { offset: 9, name: 'Eastern Indonesian Time', city: 'Jayapura', region: 'Asia' },
  
  // UTC+9.5
  { offset: 9.5, name: 'Australian Central Standard Time', city: 'Adelaide', region: 'Australia' },
  { offset: 9.5, name: 'Australian Central Standard Time', city: 'Darwin', region: 'Australia' },
  
  // UTC+10
  { offset: 10, name: 'Australian Eastern Standard Time', city: 'Sydney', region: 'Australia' },
  { offset: 10, name: 'Australian Eastern Standard Time', city: 'Melbourne', region: 'Australia' },
  { offset: 10, name: 'Australian Eastern Standard Time', city: 'Brisbane', region: 'Australia' },
  { offset: 10, name: 'Chamorro Standard Time', city: 'Guam', region: 'Pacific' },
  
  // UTC+10.5
  { offset: 10.5, name: 'Lord Howe Standard Time', city: 'Lord Howe Island', region: 'Australia' },
  
  // UTC+11
  { offset: 11, name: 'Solomon Islands Time', city: 'Honiara', region: 'Pacific' },
  { offset: 11, name: 'Vanuatu Time', city: 'Port Vila', region: 'Pacific' },
  { offset: 11, name: 'New Caledonia Time', city: 'Nouméa', region: 'Pacific' },
  
  // UTC+12
  { offset: 12, name: 'New Zealand Standard Time', city: 'Auckland', region: 'Pacific' },
  { offset: 12, name: 'Fiji Time', city: 'Suva', region: 'Pacific' },
  
  // UTC+12.75
  { offset: 12.75, name: 'Chatham Standard Time', city: 'Chatham Islands', region: 'Pacific' },
  
  // UTC+13
  { offset: 13, name: 'Tonga Time', city: 'Nuku\'alofa', region: 'Pacific' },
  { offset: 13, name: 'Phoenix Islands Time', city: 'Enderbury', region: 'Pacific' },
  
  // UTC+14
  { offset: 14, name: 'Line Islands Time', city: 'Kiritimati', region: 'Pacific' },
];

// 按地区分组的时区
export const TIMEZONES_BY_REGION = TIMEZONES.reduce((acc, tz) => {
  if (!acc[tz.region]) {
    acc[tz.region] = [];
  }
  acc[tz.region].push(tz);
  return acc;
}, {} as Record<string, TimezoneInfo[]>);

// 获取时区显示文本（智能显示：整数小时不显示分钟，有分钟才显示）
export function getTimezoneDisplay(offset: number): string {
  const sign = offset >= 0 ? '+' : '';
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset);
  const minutes = Math.round((absOffset - hours) * 60);
  
  // 如果没有分钟数，只显示小时
  if (minutes === 0) {
    return `GMT${sign}${offset}`;
  }
  
  // 有分钟数，显示完整格式
  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  return `GMT${sign}${hoursStr}:${minutesStr}`;
}

// 根据偏移量查找时区
export function findTimezoneByOffset(offset: number): TimezoneInfo | undefined {
  return TIMEZONES.find(tz => tz.offset === offset);
}
