import { ProgressContent } from '@/components/Progress/features/ProgressContent';

export function ProgressView() {
    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="flex-1 overflow-hidden p-6 pt-4 max-w-5xl mx-auto w-full animate-in fade-in duration-300">
                <ProgressContent />
            </div>
        </div>
    );
}