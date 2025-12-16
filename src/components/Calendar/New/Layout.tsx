import { ReactNode } from 'react';

interface CalendarLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  contextPanel: ReactNode;
  showContextPanel?: boolean;
}

export function CalendarLayout({ sidebar, main, contextPanel, showContextPanel = true }: CalendarLayoutProps) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 relative">
      {/* Background Ambience (Subtle Gradient underneath everything) */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 via-transparent to-purple-50/20 dark:from-blue-900/10 dark:to-purple-900/10 pointer-events-none" />

      {/* Left Sidebar: Glassmorphism */}
      <aside className="w-[260px] flex-shrink-0 border-r border-zinc-200/50 dark:border-zinc-800/50 flex flex-col bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-xl z-20">
        {sidebar}
      </aside>

      {/* Center: The Canvas */}
      <main className="flex-1 min-w-0 relative flex flex-col bg-white/50 dark:bg-zinc-950/50 z-10">
        {main}
      </main>

      {/* Right: Context / Staging Area */}
      {showContextPanel && (
        <aside className="w-[300px] flex-shrink-0 border-l border-zinc-200/50 dark:border-zinc-800/50 flex flex-col bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl z-20">
          {contextPanel}
        </aside>
      )}
    </div>
  );
}
