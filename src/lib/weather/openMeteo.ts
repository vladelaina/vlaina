/**
 * Open-Meteo API Service
 * 
 * Provides geocoding (city search) and weather forecast data.
 * No API key required.
 */

import { format } from 'date-fns';

export interface GeoLocation {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

export interface WeatherData {
  current?: {
    temperature: number;
    weatherCode: number;
    isDay: boolean;
  };
  daily?: {
    time: string[];
    weatherCode: number[];
    temperatureMax: number[];
    temperatureMin: number[];
    sunrise: string[];
    sunset: string[];
  };
  // For specific date view
  day?: {
    maxTemp: number;
    minTemp: number;
    weatherCode: number;
    sunrise?: string;
    sunset?: string;
  };
}

/**
 * Search for a city by name
 */
export async function searchCity(name: string): Promise<GeoLocation[]> {
  if (!name || name.length < 2) return [];
  
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    if (!data.results) return [];
    
    return data.results.map((item: any) => ({
      name: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
      country: item.country,
      admin1: item.admin1
    }));
  } catch (e) {
    // Only log actual errors, not aborts if we want silence, but mostly we want to see it.
    // However, to fix the user's issue, we can just log a warning for timeouts.
    console.warn("Geocoding failed/timed out", e);
    return [];
  }
}

/**
 * Get weather data for specific coordinates (Current + Forecast Range)
 * Fetches Past 92 days (Max) + Next 16 days (Max) for extensive coverage
 */
export async function getWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&past_days=92&forecast_days=16`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for larger payload

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    
    if (data.error) return null;

    return {
      current: {
        temperature: data.current.temperature_2m,
        isDay: !!data.current.is_day,
        weatherCode: data.current.weather_code
      },
      daily: {
        time: data.daily.time,
        weatherCode: data.daily.weather_code,
        temperatureMax: data.daily.temperature_2m_max,
        temperatureMin: data.daily.temperature_2m_min,
        sunrise: data.daily.sunrise,
        sunset: data.daily.sunset
      }
    };
  } catch (e) {
    console.warn("Weather fetch failed/timed out", e);
    return null;
  }
}

/**
 * Extract forecast data for a specific date from the cached WeatherData
 */
export function getForecastForDate(weather: WeatherData, date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  
  if (!weather.daily || !weather.daily.time) return null;
  
  const index = weather.daily.time.findIndex((t) => t === dateStr);
  
  if (index !== -1) {
    return {
      maxTemp: weather.daily.temperatureMax[index],
      minTemp: weather.daily.temperatureMin[index],
      weatherCode: weather.daily.weatherCode[index],
      sunrise: weather.daily.sunrise[index],
      sunset: weather.daily.sunset[index]
    };
  }
  return null;
}

/**
 * WMO Weather interpretation codes (WW)
 */
export function getWeatherDescription(code: number): { label: string; emoji: string } {
  const mapping: Record<number, { label: string; emoji: string }> = {
    0: { label: 'Clear sky', emoji: '☀️' },
    1: { label: 'Mainly clear', emoji: '☀️' },
    2: { label: 'Partly cloudy', emoji: '⛅' },
    3: { label: 'Overcast', emoji: '☁️' },
    45: { label: 'Fog', emoji: '🌫️' },
    48: { label: 'Depositing rime fog', emoji: '🌫️' },
    51: { label: 'Drizzle: Light', emoji: '🌦️' },
    53: { label: 'Drizzle: Moderate', emoji: '🌦️' },
    55: { label: 'Drizzle: Dense', emoji: '🌦️' },
    61: { label: 'Rain: Slight', emoji: '🌧️' },
    63: { label: 'Rain: Moderate', emoji: '🌧️' },
    65: { label: 'Rain: Heavy', emoji: '🌧️' },
    71: { label: 'Snow: Slight', emoji: '❄️' },
    73: { label: 'Snow: Moderate', emoji: '❄️' },
    75: { label: 'Snow: Heavy', emoji: '❄️' },
    95: { label: 'Thunderstorm', emoji: '⛈️' },
  };

  return mapping[code] || { label: 'Unknown', emoji: '☁️' };
}
