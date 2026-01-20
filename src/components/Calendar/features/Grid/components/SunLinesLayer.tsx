import { useWeatherStore } from '@/lib/weather/weatherStore';
import { getForecastForDate } from '@/lib/weather/openMeteo';
import { minutesToPixels } from '../../../utils/timeUtils';
import { format } from 'date-fns';
import { useCalendarStore } from '@/stores/useCalendarStore';

interface SunLinesLayerProps {
    days: Date[];
    hourHeight: number;
    dayStartMinutes: number;
    columnCount: number;
}

export function SunLinesLayer({ days, hourHeight, dayStartMinutes, columnCount }: SunLinesLayerProps) {
    const { weather } = useWeatherStore();
    const { use24Hour } = useCalendarStore();
    
    if (!weather) return null;

    const formatTime = (date: Date) => {
        return use24Hour ? format(date, 'H:mm') : format(date, 'h:mm a').toUpperCase();
    };

    return (
        <div className="absolute inset-0 z-20 pointer-events-none grid" style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}>
            {days.map((day, i) => {
                const forecast = getForecastForDate(weather, day);
                if (!forecast || !forecast.sunrise || !forecast.sunset) return <div key={i} />;

                const renderLine = (isoString: string, type: 'sunrise' | 'sunset') => {
                    const date = new Date(isoString);
                    const minutes = date.getHours() * 60 + date.getMinutes();
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
                            {/* Static positioning lets Flexbox handle vertical alignment */}
                            <div className="ml-1 z-50 pointer-events-auto group/item relative">
                                {/* Icon */}
                                <span className="text-[10px] leading-none inline-block transition-transform group-hover/item:scale-125">
                                    {emoji}
                                </span>
                                
                                {/* Sidebar Time Indicator (Solid background style) */}
                                <div className={`absolute right-full top-1/2 -translate-y-1/2 mr-2 px-1.5 py-0.5 rounded text-[10px] font-bold opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-sm ${labelClass}`}>
                                    {formatTime(date)}
                                </div>
                            </div>

                            {/* Dashed line (Fills remaining space) */}
                            <div className={`flex-1 border-t border-dashed ml-1 ${colorClass}`} />
                        </div>
                    );
                };

                return (
                    <div key={i} className="relative h-full"> 
                        {renderLine(forecast.sunrise!, 'sunrise')}
                        {renderLine(forecast.sunset!, 'sunset')}
                    </div>
                );
            })}
        </div>
    );
}
