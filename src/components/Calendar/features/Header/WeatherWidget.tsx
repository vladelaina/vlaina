import { useState, useEffect, useCallback } from 'react';
import { 
  MdSearch, MdLocationOn, MdClose, MdRefresh, MdCloudQueue
}
from 'react-icons/md';
import { isSameDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useWeatherStore } from '@/lib/weather/weatherStore';
import { searchCity, getWeatherDescription, getForecastForDate, type GeoLocation } from '@/lib/weather/openMeteo';

export function WeatherWidget() {
  const { city, weather, setCity, fetchWeather } = useWeatherStore();
  const { selectedDate } = useCalendarStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [popoverOpen, setDatePickerOpen] = useState(false);

  const isToday = isSameDay(selectedDate, new Date());

  // Initial fetch if needed
  useEffect(() => {
    if (city && !weather) {
        fetchWeather();
    }
  }, [city, weather, fetchWeather]);

  // Periodic refresh (every 30 mins)
  useEffect(() => {
    if (!city) return;
    const interval = setInterval(() => {
      fetchWeather();
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [city, fetchWeather]);

  // Compute display data from cached weather
  const displayWeather = useCallback(() => {
      if (!weather) return null;
      
      // If today, prioritize current conditions
      if (isToday && weather.current) {
          return { 
              temp: Math.round(weather.current.temperature),
              code: weather.current.weatherCode,
              isForecast: false
          };
      }
      
      // Otherwise find forecast
      const forecast = getForecastForDate(weather, selectedDate);
      if (forecast) {
          return {
              min: Math.round(forecast.minTemp),
              max: Math.round(forecast.maxTemp),
              code: forecast.weatherCode,
              isForecast: true
          };
      }
      
      return null;
  }, [weather, selectedDate, isToday])();

  const handleSearch = useCallback(async (val: string) => {
    setSearchQuery(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results = await searchCity(val);
    setSearchResults(results);
    setIsSearching(false);
  }, []);

  const selectCity = (loc: GeoLocation) => {
    setCity(loc);
    setDatePickerOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeCity = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCity(null);
  };

  const renderIcon = () => {
    if (!displayWeather) return null;
    const { emoji } = getWeatherDescription(displayWeather.code);
    return <span className="text-sm leading-none">{emoji}</span>;
  };

  // Determine visibility: 
  // 1. If not setup yet (no city), show the "Add weather" button.
  // 2. If setup, only show if we have data for the CURRENTLY SELECTED date (displayWeather) 
  //    or if we are still doing the very first fetch (city && !weather).
  const isSetup = !!city;
  const hasDataForDate = !!displayWeather;
  const isInitialLoading = isSetup && !weather;

  if (isSetup && !hasDataForDate && !isInitialLoading) {
      return null;
  }

  return (
    <div className="flex items-center">
      <Popover open={popoverOpen} onOpenChange={setDatePickerOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group outline-none">
            <div className="flex items-center gap-1.5">
              {displayWeather ? (
                <>
                  {renderIcon()}
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                    {displayWeather.isForecast 
                        ? `${displayWeather.max}° / ${displayWeather.min}°` 
                        : `${displayWeather.temp}°`
                    }
                  </span>
                </>
              ) : (
                <>
                  {!city && (
                    <span className="text-[10px] font-medium text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Add weather
                    </span>
                  )}
                  {isInitialLoading && (
                     <MdRefresh className="size-[18px] animate-spin text-zinc-400" />
                  )}
                </>
              )}
            </div>
          </button>
        </PopoverTrigger>
        
        <PopoverContent className="w-64 p-0 overflow-hidden bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" align="end" sideOffset={8}>
          <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <MdSearch className="absolute left-2 top-1/2 -translate-y-1/2 size-[18px] text-zinc-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search city..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto neko-scrollbar">
            {searchResults.length > 0 ? (
              searchResults.map((loc, i) => (
                <button
                  key={`${loc.name}-${i}`}
                  onClick={() => selectCity(loc)}
                  className="w-full flex items-start gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left group"
                >
                  <MdLocationOn className="size-[18px] text-zinc-400 mt-0.5 group-hover:text-blue-500 transition-colors" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{loc.name}</span>
                    <span className="text-[10px] text-zinc-400">{loc.admin1 ? `${loc.admin1}, ` : ''}{loc.country}</span>
                  </div>
                </button>
              ))
            ) : searchQuery.length >= 2 && !isSearching ? (
              <div className="p-4 text-center text-xs text-zinc-400">No cities found</div>
            ) : isSearching ? (
              <div className="p-4 flex justify-center">
                <MdRefresh className="size-[18px] animate-spin text-zinc-400" />
              </div>
            ) : city ? (
              <div className="p-2">
                <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Current</div>
                <div className="flex items-center justify-between px-2 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-md">
                  <div className="flex items-center gap-2">
                    <MdLocationOn className="size-[18px] text-blue-500" />
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{city.name}</span>
                  </div>
                  <button 
                    onClick={removeCity}
                    className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                  >
                    <MdClose className="size-[18px] text-zinc-400" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center flex flex-col items-center gap-2">
                <MdCloudQueue className="size-8 text-zinc-200 dark:text-zinc-800" />
                <p className="text-xs text-zinc-400">Search for a city to see local weather</p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
