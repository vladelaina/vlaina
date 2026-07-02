import { AppViewModeSwitch } from '@/components/layout/sidebar/AppViewModeSwitch';
import {
  SidebarActionGroup,
  SidebarCapsulePanel,
  SidebarSurface,
} from '@/components/layout/sidebar/SidebarPrimitives';

export function WhiteboardSidebar() {
  return (
    <SidebarSurface className="bg-[var(--vlaina-sidebar-notes-surface)] text-[var(--vlaina-sidebar-notes-text)]">
      <SidebarCapsulePanel>
        <SidebarActionGroup>
          <AppViewModeSwitch />
        </SidebarActionGroup>
      </SidebarCapsulePanel>
    </SidebarSurface>
  );
}
