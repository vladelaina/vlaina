import { useEffect, useState } from 'react';
import { TaskList } from '@/components/features/TaskList';
import { TaskInput } from '@/components/features/TaskInput';
import { CommandMenu } from '@/components/features/CommandMenu';
import { StatsDialog } from '@/components/features/StatsDialog';
import { Layout } from '@/components/layout';
import { ThemeProvider } from '@/components/theme-provider';
import { useTaskStore } from '@/stores/useTaskStore';
import { useVimShortcuts } from '@/hooks/useVimShortcuts';

function AppContent() {
  const { loadTasks, isLoading, isInitialized } = useTaskStore();
  const [statsOpen, setStatsOpen] = useState(false);

  // Enable VIM-style keyboard navigation
  useVimShortcuts();

  // Load tasks on app startup
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleFocusInput = () => {
    // Focus the task input
    const input = document.querySelector<HTMLInputElement>(
      'input[placeholder*="task"]'
    );
    input?.focus();
  };

  return (
    <>
      {/* Command Palette (⌘K) */}
      <CommandMenu 
        onFocusInput={handleFocusInput} 
        onOpenStats={() => setStatsOpen(true)}
      />

      {/* Stats Dialog */}
      <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} />

      <Layout>
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Loading State */}
          {isLoading && !isInitialized && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Loading tasks...
            </div>
          )}

          {/* Main Content */}
          {isInitialized && (
            <>
              {/* Task Input */}
              <div className="mb-4">
                <TaskInput />
              </div>

              {/* Task List */}
              <TaskList />
            </>
          )}
        </div>
      </Layout>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
