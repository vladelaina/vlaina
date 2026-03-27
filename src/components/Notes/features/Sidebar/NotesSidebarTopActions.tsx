import { SidebarChatButton } from './SidebarChatButton';
import { NotesSidebarViewToggle } from './NotesSidebarViewToggle';
import { SidebarActionGroup } from '@/components/layout/sidebar/SidebarPrimitives';

export function NotesSidebarTopActions() {
  return (
    <SidebarActionGroup>
      <NotesSidebarViewToggle />
      <SidebarChatButton />
    </SidebarActionGroup>
  );
}
