import { motion } from 'framer-motion';
import { AppUsage, TimeRange, SourceType } from './types';
import { formatDuration } from './utils';

interface TimeChartProps {
  selectedApp: AppUsage | null;
  timeRange: TimeRange;
  sourceType: SourceType;
  todayTotal: number;
}

export function TimeChart({ selectedApp, timeRange, sourceType, todayTotal }: TimeChartProps) {
  return (
    <div className="max-w-xl mx-auto mb-6">
      <div className="flex justify-between h-16 gap-1 mt-10">
        {(() => {
          // 为选中的应用生成随机但稳定的数据
          const generateAppData = (name: string, range: TimeRange): number[] => {
            const seed = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            const counts = { day: 24, month: 30, year: 12 };
            return Array.from({ length: counts[range] }, (_, i) => {
              const val = Math.sin(seed + i * 0.5) * 0.5 + 0.5;
              return Math.max(0.05, Math.min(1, val * (0.7 + Math.sin(i) * 0.3)));
            });
          };

          // 不同条件下的柱状图数据
          const chartData: Record<string, Record<string, number[]>> = {
            app: {
              day: [0, 0, 0, 0, 0, 0.1, 0.2, 0.4, 0.7, 0.9, 0.95, 0.8, 0.5, 0.6, 0.85, 0.9, 0.75, 0.6, 0.7, 0.8, 0.6, 0.4, 0.2, 0.05],
              month: [0.6, 0.7, 0.5, 0.8, 0.9, 0.4, 0.3, 0.85, 0.75, 0.6, 0.7, 0.8, 0.55, 0.65, 0.9, 0.7, 0.5, 0.6, 0.8, 0.7, 0.6, 0.5, 0.7, 0.8, 0.6, 0.5, 0.7, 0.85, 0.6, 0.4],
              year: [0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.85, 0.75, 0.6],
            },
            web: {
              day: [0, 0, 0, 0, 0, 0.05, 0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.85, 0.7, 0.6, 0.5, 0.4, 0.5, 0.6, 0.75, 0.85, 0.7, 0.5, 0.2],
              month: [0.5, 0.6, 0.4, 0.7, 0.8, 0.5, 0.4, 0.75, 0.65, 0.5, 0.6, 0.7, 0.45, 0.55, 0.8, 0.6, 0.4, 0.5, 0.7, 0.6, 0.5, 0.4, 0.6, 0.7, 0.5, 0.4, 0.6, 0.75, 0.5, 0.3],
              year: [0.2, 0.3, 0.4, 0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.75, 0.65, 0.5],
            },
          };
          
          const data = selectedApp 
            ? generateAppData(selectedApp.name, timeRange)
            : chartData[sourceType][timeRange];
            
          const labels = timeRange === 'day' 
            ? { count: 24, format: (i: number) => `${i}:00 - ${i + 1}:00` }
            : timeRange === 'month'
              ? { count: 30, format: (i: number) => `${i + 1}日` }
              : { count: 12, format: (i: number) => `${i + 1}月` };
          
          // 计算显示的时长（基于usage比例和总时长）
          const totalDuration = selectedApp?.duration || todayTotal;
          
          return Array.from({ length: labels.count }, (_, i) => {
            const usage = data[i] || 0;
            const duration = Math.floor(totalDuration * usage / data.reduce((a, b) => a + b, 0));
            const isCurrent = timeRange === 'day' 
              ? new Date().getHours() === i
              : timeRange === 'month'
                ? new Date().getDate() - 1 === i
                : new Date().getMonth() === i;
            
            const barHeight = Math.max(usage * 100, 4);
            
            return (
              <div key={i} className="flex-1 h-full flex flex-col justify-end relative group">
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="font-medium">{labels.format(i)}</div>
                  <div className="text-zinc-300">{formatDuration(duration)}</div>
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
                </div>
                
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${barHeight}%` }}
                  transition={{ duration: 0.4, delay: i * 0.015 }}
                  style={{ height: `${barHeight}%` }}
                  className={`w-full rounded-sm cursor-pointer hover:opacity-80 ${
                    isCurrent 
                      ? 'bg-zinc-700' 
                      : usage > 0.7 
                        ? 'bg-zinc-400' 
                        : usage > 0.3 
                          ? 'bg-zinc-300' 
                          : 'bg-zinc-200'
                  }`}
                />
              </div>
            );
          });
        })()}
      </div>
      {/* Time Labels */}
      <div className="flex justify-between mt-1 text-xs text-zinc-400">
        {timeRange === 'day' ? (
          <>
            <span>0时</span>
            <span>6时</span>
            <span>12时</span>
            <span>18时</span>
            <span>24时</span>
          </>
        ) : timeRange === 'month' ? (
          <>
            <span>1日</span>
            <span>8日</span>
            <span>15日</span>
            <span>22日</span>
            <span>30日</span>
          </>
        ) : (
          <>
            <span>1月</span>
            <span>4月</span>
            <span>7月</span>
            <span>10月</span>
            <span>12月</span>
          </>
        )}
      </div>
    </div>
  );
}
