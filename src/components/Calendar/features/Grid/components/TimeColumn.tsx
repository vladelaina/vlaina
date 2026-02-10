
import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { displayPositionToHour, minutesToPixels, CALENDAR_CONSTANTS } from '../../../utils/timeUtils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { TIMEZONES, getTimezoneDisplay } from '@/lib/config/timezones';

const GUTTER_WIDTH = CALENDAR_CONSTANTS.GUTTER_WIDTH as number;

interface TimeColumnProps {
    hourHeight: number;
    dayStartMinutes: number;
    use24Hour: boolean;
    dragTimeIndicator: { startMinutes: number; endMinutes: number } | null;
    hoverTimeIndicator: { startMinutes: number; endMinutes: number } | null;
}

export function TimeColumn({
    hourHeight,
    dayStartMinutes,
    use24Hour,
    dragTimeIndicator,
    hoverTimeIndicator,
}: TimeColumnProps) {
    const { setDayStartTime, toggle24Hour, timezone, timezoneCity, setTimezone } = useCalendarStore();
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [showTimezoneList, setShowTimezoneList] = useState(false);
    const [timezoneSearch, setTimezoneSearch] = useState('');

    // 计算起始时间的显示
    const startHour = Math.floor(dayStartMinutes / 60);
    const startMinute = dayStartMinutes % 60;
    const startTimeDisplay = use24Hour
        ? `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`
        : startHour === 0 
            ? `12:${String(startMinute).padStart(2, '0')}AM`
            : startHour < 12 
                ? `${startHour}:${String(startMinute).padStart(2, '0')}AM`
                : startHour === 12 
                    ? `12:${String(startMinute).padStart(2, '0')}PM`
                    : `${startHour - 12}:${String(startMinute).padStart(2, '0')}PM`;

    // 常用的起始时间选项（以分钟为单位）
    const startTimeOptions = [
        { label12: '12AM', label24: '00:00', value: 0 },
        { label12: '1AM', label24: '01:00', value: 60 },
        { label12: '2AM', label24: '02:00', value: 120 },
        { label12: '3AM', label24: '03:00', value: 180 },
        { label12: '4AM', label24: '04:00', value: 240 },
        { label12: '5AM', label24: '05:00', value: 300 },
        { label12: '6AM', label24: '06:00', value: 360 },
        { label12: '7AM', label24: '07:00', value: 420 },
    ];

    const handleStartTimeChange = (minutes: number) => {
        setDayStartTime(minutes);
        setPopoverOpen(false);
    };

    const handleToggle24Hour = () => {
        toggle24Hour();
    };

    const handleTimezoneSelect = (offset: number, city: string) => {
        setTimezone(offset, city);
        setShowTimezoneList(false);
        setTimezoneSearch('');
    };

    // 获取当前时区信息
    const currentTimezone = TIMEZONES.find(tz => 
        tz.offset === timezone && 
        tz.city === timezoneCity
    ) || TIMEZONES[0];
    const currentTimezoneDisplay = `${getTimezoneDisplay(currentTimezone.offset)} ${currentTimezone.city}`;

    // 过滤时区列表
    const filteredTimezones = timezoneSearch
        ? TIMEZONES.filter(tz => 
            tz.city.toLowerCase().includes(timezoneSearch.toLowerCase()) ||
            tz.region.toLowerCase().includes(timezoneSearch.toLowerCase()) ||
            getTimezoneDisplay(tz.offset).includes(timezoneSearch)
          )
        : TIMEZONES;

    return (
        <div style={{ width: GUTTER_WIDTH }} className="flex-shrink-0 sticky left-0 z-10 bg-white dark:bg-zinc-950 relative">
            {/* 起始时间标签 - 固定在顶部 */}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <button 
                        className="absolute top-0 right-0 pt-1 text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium tabular-nums px-1 rounded-sm transition-all z-20"
                    >
                        {startTimeDisplay}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0" align="start" sideOffset={4}>
                    {!showTimezoneList ? (
                        <div className="p-3">
                            {/* 起始时间选择 */}
                            <div className="mb-3">
                                <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                                    Start time
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                    {startTimeOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => handleStartTimeChange(option.value)}
                                            className={`px-2 py-1.5 text-xs rounded transition-colors ${
                                                dayStartMinutes === option.value
                                                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium'
                                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                            }`}
                                        >
                                            {use24Hour ? option.label24 : option.label12}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 分割线 */}
                            <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-3" />

                            {/* 时间格式切换 */}
                            <div className="mb-3">
                                <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                                    Time format
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                    <button
                                        onClick={handleToggle24Hour}
                                        className={`px-2 py-1.5 text-xs rounded transition-colors ${
                                            !use24Hour
                                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium'
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                        }`}
                                    >
                                        12-hour
                                    </button>
                                    <button
                                        onClick={handleToggle24Hour}
                                        className={`px-2 py-1.5 text-xs rounded transition-colors ${
                                            use24Hour
                                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium'
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                        }`}
                                    >
                                        24-hour
                                    </button>
                                </div>
                            </div>

                            {/* 分割线 */}
                            <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-3" />

                            {/* 时区选择 - 极简设计 */}
                            <button
                                onClick={() => setShowTimezoneList(true)}
                                className="w-full flex items-center justify-between px-1 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors text-left"
                            >
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                                    {currentTimezoneDisplay}
                                </span>
                                <Icon name="nav.chevronDown" className="w-3 h-3 text-zinc-300 dark:text-zinc-600 flex-shrink-0 ml-1" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col max-h-96">
                            {/* 时区列表头部 */}
                            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-3 z-10">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                        Select Timezone
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowTimezoneList(false);
                                            setTimezoneSearch('');
                                        }}
                                        className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                    >
                                        Back
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search city..."
                                    value={timezoneSearch}
                                    onChange={(e) => setTimezoneSearch(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
                                    autoFocus
                                />
                            </div>

                            {/* 时区列表 */}
                            <div className="overflow-y-auto neko-scrollbar">
                                {filteredTimezones.length > 0 ? (
                                    filteredTimezones.map((tz, idx) => {
                                        // 精确匹配 offset 和 city
                                        const isSelected = tz.offset === currentTimezone.offset && 
                                            tz.city === currentTimezone.city;
                                        
                                        return (
                                            <button
                                                key={`${tz.offset}-${idx}`}
                                                onClick={() => handleTimezoneSelect(tz.offset, tz.city)}
                                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className="text-xs text-zinc-400 font-mono w-16 flex-shrink-0">
                                                        {getTimezoneDisplay(tz.offset)}
                                                    </span>
                                                    <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">
                                                        {tz.city}
                                                    </span>
                                                </div>
                                                {isSelected && (
                                                    <Icon name="common.check" className="w-4 h-4 text-zinc-500 flex-shrink-0 ml-2" />
                                                )}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="p-8 text-center text-xs text-zinc-400">
                                        No timezone found
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </PopoverContent>
            </Popover>

            {Array.from({ length: 24 }).map((_, displayPos) => {
                const actualHour = displayPositionToHour(displayPos, dayStartMinutes);
                return (
                    <div key={displayPos} style={{ height: hourHeight }} className="relative">
                        {displayPos !== 0 && (
                            <span className="absolute -top-2 right-3 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium tabular-nums">
                                {use24Hour
                                    ? `${actualHour}:00`
                                    : actualHour === 0 ? '12AM'
                                        : actualHour < 12 ? `${actualHour}AM`
                                            : actualHour === 12 ? '12PM'
                                                : `${actualHour - 12}PM`
                                }
                            </span>
                        )}
                    </div>
                );
            })}

            {/* Drag time indicators */}
            {dragTimeIndicator && (
                <>
                    {/* Start time indicator */}
                    {dragTimeIndicator.startMinutes % 60 !== 0 && (
                        <div
                            className="absolute z-20 pointer-events-none"
                            style={{
                                top: `${minutesToPixels(dragTimeIndicator.startMinutes, hourHeight, dayStartMinutes)}px`,
                                right: 12,
                                transform: 'translateY(-50%)',
                            }}
                        >
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium tabular-nums">
                                :{String(dragTimeIndicator.startMinutes % 60).padStart(2, '0')}
                            </span>
                        </div>
                    )}
                    {/* End time indicator */}
                    {dragTimeIndicator.endMinutes % 60 !== 0 && (
                        <div
                            className="absolute z-20 pointer-events-none"
                            style={{
                                top: `${minutesToPixels(dragTimeIndicator.endMinutes, hourHeight, dayStartMinutes)}px`,
                                right: 12,
                                transform: 'translateY(-50%)',
                            }}
                        >
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium tabular-nums">
                                :{String(dragTimeIndicator.endMinutes % 60).padStart(2, '0')}
                            </span>
                        </div>
                    )}
                </>
            )}

            {/* Hover time indicator */}
            {hoverTimeIndicator && !dragTimeIndicator && (
                <>
                    {/* Start time indicator */}
                    {hoverTimeIndicator.startMinutes % 60 !== 0 && (
                        <div
                            className="absolute z-20 pointer-events-none transition-all duration-75"
                            style={{
                                top: `${minutesToPixels(hoverTimeIndicator.startMinutes, hourHeight, dayStartMinutes)}px`,
                                right: 12,
                                transform: 'translateY(-50%)',
                            }}
                        >
                            <span className="text-[11px] text-zinc-400/70 dark:text-zinc-500/70 font-medium tabular-nums">
                                :{String(hoverTimeIndicator.startMinutes % 60).padStart(2, '0')}
                            </span>
                        </div>
                    )}
                    {/* End time indicator */}
                    {hoverTimeIndicator.endMinutes % 60 !== 0 && (
                        <div
                            className="absolute z-20 pointer-events-none transition-all duration-75"
                            style={{
                                top: `${minutesToPixels(hoverTimeIndicator.endMinutes, hourHeight, dayStartMinutes)}px`,
                                right: 12,
                                transform: 'translateY(-50%)',
                            }}
                        >
                            <span className="text-[11px] text-zinc-400/70 dark:text-zinc-500/70 font-medium tabular-nums">
                                :{String(hoverTimeIndicator.endMinutes % 60).padStart(2, '0')}
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}