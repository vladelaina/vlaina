import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GeoLocation, WeatherData, getWeather } from './openMeteo';

interface WeatherState {
  city: GeoLocation | null;
  weather: WeatherData | null;
  setCity: (city: GeoLocation | null) => void;
  fetchWeather: () => Promise<void>;
}

export const useWeatherStore = create<WeatherState>()(
  persist(
    (set, get) => ({
      city: null,
      weather: null,
      setCity: (city) => {
        set({ city, weather: null }); // Clear weather on city change
        if (city) {
            get().fetchWeather();
        }
      },
      fetchWeather: async () => {
        const { city } = get();
        if (!city) return;
        const data = await getWeather(city.latitude, city.longitude);
        set({ weather: data });
      },
    }),
    {
      name: 'nekotick-weather-city', // Keep same key for backward compatibility if possible
      partialize: (state) => ({ city: state.city }), // Only persist city, weather is transient
    }
  )
);

// Compatibility hook for components that used the old hook style
export function useWeatherCity() {
  const { city, setCity } = useWeatherStore();
  return { city, updateCity: setCity };
}
