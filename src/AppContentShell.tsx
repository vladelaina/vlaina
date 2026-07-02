import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/layout/shell/AppShell';
import { SidebarUserHeader } from '@/components/layout/SidebarUserHeader';
import { cn } from '@/lib/utils';
import { useUIStore, type AppViewMode } from '@/stores/uiSlice';
import type { CommunitySettings } from '@/components/Settings/tabs/aboutCommunitySettings';
import type { SettingsOpenTab } from '@/components/Settings/settingsEvents';
import {
  ChatSidebar,
  ChatView,
  DevMainOverlay,
  LabView,
  ModelSelector,
  NotesSidebarWrapper,
  NotesTabRow,
  NotesView,
  SettingsModal,
  StartupViewFallback,
  TemporaryChatToggle,
  WhiteboardSidebar,
  WhiteboardView,
} from './AppContentModules';

type ReadyAppViewMode = Extract<AppViewMode, 'notes' | 'chat' | 'whiteboard'>;

interface AppContentShellProps {
  communitySettings: CommunitySettings;
  effectiveAppViewMode: AppViewMode;
  hasOpenedSettings: boolean;
  mountedAppViews: Set<AppViewMode>;
  onActiveViewReady: (viewMode: ReadyAppViewMode) => void;
  onPrimaryContentReady: (viewMode: ReadyAppViewMode) => void;
  onSettingsClose: () => void;
  onStartupFallbackReady: () => void;
  renderedSidebarAppViews: Set<AppViewMode>;
  settingsOpen: boolean;
  settingsRequestedTab?: SettingsOpenTab;
  shouldRenderCenterChrome: boolean;
  shouldRenderDeferredChrome: boolean;
  shouldWaitForInitialUnifiedView: boolean;
}

function ConnectedAppShell({
  children,
  effectiveAppViewMode,
  mainOverlay,
  settingsOpen,
  sidebarContent,
  titleBarCenter,
  titleBarRight,
}: {
  children: ReactNode;
  effectiveAppViewMode: AppViewMode;
  mainOverlay: ReactNode;
  settingsOpen: boolean;
  sidebarContent: ReactNode;
  titleBarCenter: ReactNode;
  titleBarRight: ReactNode;
}) {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <AppShell
      sidebarWidth={sidebarWidth}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarWidthChange={setSidebarWidth}
      onSidebarToggle={toggleSidebar}
      sidebarContent={sidebarContent}
      titleBarLeft={
        <SidebarUserHeader toggleSidebar={toggleSidebar} interactionSuppressed={settingsOpen} />
      }
      titleBarCenter={titleBarCenter}
      titleBarRight={titleBarRight}
      titleBarCenterOverflowVisible={effectiveAppViewMode === 'chat'}
      mainOverlay={mainOverlay}
      backgroundColor="transparent"
    >
      {children}
    </AppShell>
  );
}

export function AppContentShell({
  communitySettings,
  effectiveAppViewMode,
  hasOpenedSettings,
  mountedAppViews,
  onActiveViewReady,
  onPrimaryContentReady,
  onSettingsClose,
  onStartupFallbackReady,
  renderedSidebarAppViews,
  settingsOpen,
  settingsRequestedTab,
  shouldRenderCenterChrome,
  shouldRenderDeferredChrome,
  shouldWaitForInitialUnifiedView,
}: AppContentShellProps) {
  const shouldRenderSidebar =
    effectiveAppViewMode === 'chat' ||
    effectiveAppViewMode === 'notes' ||
    (import.meta.env.DEV && effectiveAppViewMode === 'whiteboard');
  const shouldMountNotes = mountedAppViews.has('notes');
  const shouldMountChat = mountedAppViews.has('chat');
  const shouldMountWhiteboard = import.meta.env.DEV && mountedAppViews.has('whiteboard');
  const shouldRenderNotesSidebar = renderedSidebarAppViews.has('notes');
  const shouldRenderChatSidebar = renderedSidebarAppViews.has('chat');
  const shouldShowNotesSidebar = effectiveAppViewMode === 'notes';
  const shouldShowChatSidebar = effectiveAppViewMode === 'chat';

  const sidebarContent = shouldRenderSidebar ? effectiveAppViewMode === 'whiteboard' ? (
    <Suspense fallback={null}>
      {WhiteboardSidebar ? <WhiteboardSidebar /> : null}
    </Suspense>
  ) : (
    <div className="grid h-full min-h-0">
      {shouldRenderChatSidebar ? (
        <div
          className={cn(
            'col-start-1 row-start-1 h-full min-h-0',
            !shouldShowChatSidebar && 'pointer-events-none hidden',
          )}
          aria-hidden={!shouldShowChatSidebar}
        >
          <Suspense fallback={null}>
            <ChatSidebar isPeeking={false} active={shouldShowChatSidebar} />
          </Suspense>
        </div>
      ) : null}
      {shouldRenderNotesSidebar ? (
        <div
          className={cn(
            'col-start-1 row-start-1 h-full min-h-0',
            !shouldShowNotesSidebar && 'pointer-events-none hidden',
          )}
          aria-hidden={!shouldShowNotesSidebar}
        >
          <Suspense fallback={null}>
            <NotesSidebarWrapper isPeeking={false} active={shouldShowNotesSidebar} />
          </Suspense>
        </div>
      ) : null}
    </div>
  ) : null;

  const centerSlot = !shouldRenderCenterChrome ? null : effectiveAppViewMode === 'notes' ? (
    <Suspense fallback={null}>
      <NotesTabRow />
    </Suspense>
  ) : effectiveAppViewMode === 'chat' ? (
    <Suspense fallback={null}>
      <div className="flex h-full items-center pl-2">
        <ModelSelector dropdownPlacement="bottom" dropdownAlign="left" />
      </div>
    </Suspense>
  ) : null;

  const rightSlot = shouldRenderDeferredChrome && effectiveAppViewMode === 'chat' ? (
    <Suspense fallback={null}>
      <TemporaryChatToggle />
    </Suspense>
  ) : null;

  const mainContent = shouldWaitForInitialUnifiedView ? (
    <StartupViewFallback onReady={onStartupFallbackReady} />
  ) : import.meta.env.DEV && effectiveAppViewMode === 'lab' && LabView ? (
    <Suspense fallback={null}>
      <LabView />
    </Suspense>
  ) : (
    <>
      {shouldMountNotes ? (
        <div className={cn('h-full', effectiveAppViewMode !== 'notes' && 'hidden')} aria-hidden={effectiveAppViewMode !== 'notes'}>
          <Suspense fallback={<StartupViewFallback onReady={onStartupFallbackReady} />}>
            <NotesView
              active={effectiveAppViewMode === 'notes'}
              onStartupReady={() => onActiveViewReady('notes')}
              onPrimaryContentReady={() => onPrimaryContentReady('notes')}
            />
          </Suspense>
        </div>
      ) : null}
      {shouldMountChat ? (
        <div className={cn('h-full', effectiveAppViewMode !== 'chat' && 'hidden')} aria-hidden={effectiveAppViewMode !== 'chat'}>
          <Suspense fallback={<StartupViewFallback onReady={onStartupFallbackReady} />}>
            <ChatView
              active={effectiveAppViewMode === 'chat'}
              onStartupReady={() => onActiveViewReady('chat')}
              onPrimaryContentReady={() => onPrimaryContentReady('chat')}
            />
          </Suspense>
        </div>
      ) : null}
      {shouldMountWhiteboard ? (
        <div className={cn('h-full', effectiveAppViewMode !== 'whiteboard' && 'hidden')} aria-hidden={effectiveAppViewMode !== 'whiteboard'}>
          <Suspense fallback={<StartupViewFallback onReady={onStartupFallbackReady} />}>
            {WhiteboardView ? (
              <WhiteboardView
                active={effectiveAppViewMode === 'whiteboard'}
                onStartupReady={() => onActiveViewReady('whiteboard')}
                onPrimaryContentReady={() => onPrimaryContentReady('whiteboard')}
              />
            ) : null}
          </Suspense>
        </div>
      ) : null}
    </>
  );

  const mainOverlay = import.meta.env.DEV && DevMainOverlay ? (
    <Suspense fallback={null}>
      <DevMainOverlay effectiveAppViewMode={effectiveAppViewMode} />
    </Suspense>
  ) : null;

  return (
    <>
      <Suspense fallback={null}>
        {hasOpenedSettings ? (
          <SettingsModal
            open={settingsOpen}
            communitySettings={communitySettings}
            requestedTab={settingsRequestedTab}
            onClose={onSettingsClose}
          />
        ) : null}
      </Suspense>

      <ConnectedAppShell
        effectiveAppViewMode={effectiveAppViewMode}
        settingsOpen={settingsOpen}
        sidebarContent={sidebarContent}
        titleBarCenter={centerSlot}
        titleBarRight={rightSlot}
        mainOverlay={mainOverlay}
      >
        {mainContent}
      </ConnectedAppShell>
    </>
  );
}
