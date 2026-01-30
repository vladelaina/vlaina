import { ProgressContent } from '@/components/Progress/features/ProgressContent';

/**
 * ProgressView - Wrapper for the Progress/Insights content.
 */
export function ProgressView() {
    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="flex-shrink-0 px-8 py-5 z-10">
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Insights
                </h1>
            </div>
            <div className="flex-1 overflow-hidden p-6 max-w-5xl mx-auto w-full animate-in fade-in duration-300">
                <ProgressContent />
            </div>
        </div>
    );
}