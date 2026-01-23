import { useWeatherStore } from '@/lib/weather/weatherStore';
import { getForecastForDate } from '@/lib/weather/openMeteo';
import { minutesToPixels } from '../../../utils/timeUtils';
import { format } from 'date-fns';
import { useCalendarStore } from '@/stores/useCalendarStore';

interface SunLinesLayerProps {
    days: Date[];
    hourHeight: number;
    dayStartMinutes: number;
}

export function SunLinesLayer({ days, hourHeight, dayStartMinutes }: SunLinesLayerProps) {
    const { weather } = useWeatherStore();
    const { use24Hour } = useCalendarStore();
    
    if (!weather) return null;

    const formatTime = (date: Date) => {
        return use24Hour ? format(date, 'H:mm') : format(date, 'h:mm a').toUpperCase();
    };

    // We only use the first day's forecast to draw a straight reference line across the view
    // This avoids visual jumping due to daily variations or API inconsistencies
    const firstDay = days[0];
    const forecast = firstDay ? getForecastForDate(weather, firstDay) : null;

    if (!forecast || !forecast.sunrise || !forecast.sunset) return null;

    const renderSingleLine = (isoString: string, type: 'sunrise' | 'sunset') => {
        // Manually parse the ISO string to avoid inconsistent timezone handling
        const [datePart, timePart] = isoString.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, mins] = timePart.split(':').map(Number);
        
        // Create date object in local context to match the grid
        const date = new Date(year, month - 1, day, hours, mins);
        const minutes = hours * 60 + mins;
        
        const top = minutesToPixels(minutes, hourHeight, dayStartMinutes);
        
        const colorClass = type === 'sunrise' ? 'text-orange-400 border-orange-400/30' : 'text-indigo-400 border-indigo-400/30';
        const labelClass = type === 'sunrise' ? 'bg-orange-400 text-white' : 'bg-indigo-400 text-white';
        const emoji = type === 'sunrise' ? '🌅' : '🌇';

        return (
            <div 
                className={`absolute w-full flex items-center group ${colorClass}`}
                style={{ top: `${top}px` }}
            >
                {/* Interactive Wrapper for Left Icon & Sidebar Time */}
                <div className="ml-1 z-50 pointer-events-auto group/item relative flex-shrink-0">
                    {/* Icon */}
                    <span className="text-[10px] leading-none inline-block transition-transform group-hover/item:scale-125">
                        {emoji}
                    </span>
                    
                    {/* Sidebar Time Indicator (Solid background style) */}
                    <div className={`absolute right-full top-1/2 -translate-y-1/2 mr-2 px-1.5 py-0.5 rounded text-[10px] font-bold opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-sm ${labelClass}`}>
                        {formatTime(date)}
                    </div>
                </div>

                {/* Dashed line (Fills full width) */}
                <div className={`flex-1 border-t border-dashed ml-1 ${colorClass}`} />
            </div>
        );
    };

    return (
        <div className="absolute inset-0 z-20 pointer-events-none">
            {renderSingleLine(forecast.sunrise!, 'sunrise')}
            {renderSingleLine(forecast.sunset!, 'sunset')}
        </div>
    );
}
