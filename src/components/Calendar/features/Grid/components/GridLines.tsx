

interface GridLinesProps {
    hourHeight: number;
    columnCount: number;
    days: Date[];
}

export function GridLines({ hourHeight, columnCount, days }: GridLinesProps) {
    return (
        <>
            {/* Grid lines */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                {Array.from({ length: 24 }).map((_, hour) => (
                    <div key={hour} style={{ height: hourHeight }} className="relative w-full">
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-zinc-200/80 dark:bg-zinc-700/50" />
                        {hourHeight >= 200 && (
                            <div className="absolute left-0 right-0 h-px bg-zinc-100 dark:bg-zinc-800/40" style={{ top: '50%' }} />
                        )}
                    </div>
                ))}
            </div>

            {/* Column dividers */}
            <div
                className="absolute inset-0 grid z-0 pointer-events-none"
                style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
            >
                {days.map((_day, i) => (
                    <div
                        key={i}
                        className="border-r border-zinc-100 dark:border-zinc-800/50 last:border-r-0 h-full"
                    />
                ))}
            </div>
        </>
    );
}