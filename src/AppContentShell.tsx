import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/layout/shell/AppShell';
import { TitleBarCenterRegion, TitleBarInteractiveRegion } from '@/components/layout/shell/TitleBarCenterRegion';
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
  renderSidebarContent,
  titleBarCenter,
  titleBarRight,
}: {
  children: ReactNode;
  effectiveAppViewMode: AppViewMode;
  mainOverlay: ReactNode;
  settingsOpen: boolean;
  renderSidebarContent: (isPeeking: boolean) => ReactNode;
  titleBarCenter: ReactNode;
  titleBarRight: ReactNode;
}) {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const sidebarContent = renderSidebarContent(sidebarCollapsed);

  return (
    <AppShell
      sidebarWidth={sidebarWidth}
      sidebarCollapsed={sidebarCollapsed}
      sidebarHoverPeekEnabled={effectiveAppViewMode !== 'whiteboard'}
      onSidebarWidthChange={setSidebarWidth}
      onSidebarToggle={toggleSidebar}
      sidebarContent={sidebarContent}
      titleBarLeft={
        <SidebarUserHeader toggleSidebar={toggleSidebar} interactionSuppressed={settingsOpen} />
      }
      titleBarCenter={titleBarCenter}
      titleBarRight={titleBarRight}
      titleBarCenterOverflowVisible={effectiveAppViewMode === 'chat' || effectiveAppViewMode === 'whiteboard'}
      mainOverlay={mainOverlay}
      backgroundColor="transparent"
    >
      {children}
    </AppShell>
  );
}

function SidebarPane({ children, visible }: { children: ReactNode; visible: boolean }) {
  return (
    <div
      className={cn(
        'col-start-1 row-start-1 h-full min-h-0 min-w-0 overflow-hidden',
        !visible && 'pointer-events-none hidden',
      )}
      aria-hidden={!visible}
    >
      {children}
    </div>
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
    effectiveAppViewMode === 'whiteboard';
  const shouldMountNotes = mountedAppViews.has('notes');
  const shouldMountChat = mountedAppViews.has('chat');
  const shouldMountWhiteboard = mountedAppViews.has('whiteboard');
  const shouldRenderNotesSidebar = renderedSidebarAppViews.has('notes');
  const shouldRenderChatSidebar = renderedSidebarAppViews.has('chat');
  const shouldRenderWhiteboardSidebar = renderedSidebarAppViews.has('whiteboard');
  const shouldShowNotesSidebar = effectiveAppViewMode === 'notes';
  const shouldShowChatSidebar = effectiveAppViewMode === 'chat';
  const shouldShowWhiteboardSidebar = effectiveAppViewMode === 'whiteboard';

  const renderSidebarContent = (isPeeking: boolean) => shouldRenderSidebar ? (
    <div className="grid h-full min-h-0 min-w-0 overflow-hidden">
      {shouldRenderChatSidebar ? (
        <SidebarPane visible={shouldShowChatSidebar}>
          <Suspense fallback={null}>
            <ChatSidebar isPeeking={isPeeking} active={shouldShowChatSidebar} />
          </Suspense>
        </SidebarPane>
      ) : null}
      {shouldRenderNotesSidebar ? (
        <SidebarPane visible={shouldShowNotesSidebar}>
          <Suspense fallback={null}>
            <NotesSidebarWrapper isPeeking={isPeeking} active={shouldShowNotesSidebar} />
          </Suspense>
        </SidebarPane>
      ) : null}
      {shouldRenderWhiteboardSidebar ? (
        <SidebarPane visible={shouldShowWhiteboardSidebar}>
          <Suspense fallback={null}>
            <WhiteboardSidebar />
          </Suspense>
        </SidebarPane>
      ) : null}
    </div>
  ) : null;

  const centerSlot = !shouldRenderCenterChrome ? null : effectiveAppViewMode === 'notes' ? (
    <Suspense fallback={null}>
      <NotesTabRow />
    </Suspense>
  ) : effectiveAppViewMode === 'chat' ? (
    <Suspense fallback={null}>
      <TitleBarCenterRegion>
        <TitleBarInteractiveRegion>
          <ModelSelector dropdownPlacement="bottom" dropdownAlign="left" />
        </TitleBarInteractiveRegion>
      </TitleBarCenterRegion>
    </Suspense>
  ) : effectiveAppViewMode === 'whiteboard' ? (
    <TitleBarCenterRegion data-whiteboard-titlebar-slot="true" />
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
            <WhiteboardView
              active={effectiveAppViewMode === 'whiteboard'}
              onStartupReady={() => onActiveViewReady('whiteboard')}
              onPrimaryContentReady={() => onPrimaryContentReady('whiteboard')}
            />
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
        renderSidebarContent={renderSidebarContent}
        titleBarCenter={centerSlot}
        titleBarRight={rightSlot}
        mainOverlay={mainOverlay}
      >
        {mainContent}
      </ConnectedAppShell>
    </>
  );
}
