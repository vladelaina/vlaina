import { ReactNode } from 'react';
import { TitleBar } from './TitleBar';

interface LayoutProps {
  children: ReactNode;
  onOpenSettings?: () => void;
  toolbar?: ReactNode;
  showRightPanelDivider?: boolean;
}

export function Layout({ children, onOpenSettings, toolbar, showRightPanelDivider }: LayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Custom Title Bar */}
      <TitleBar onOpenSettings={onOpenSettings} toolbar={toolbar} showRightPanelDivider={showRightPanelDivider} />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
