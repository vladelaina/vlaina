import { SidebarChatButton } from './SidebarChatButton';
import { NotesSidebarViewToggle } from './NotesSidebarViewToggle';

export function NotesSidebarTopActions() {
  return (
    <div className="px-1 pt-1 pb-1 space-y-1">
      <NotesSidebarViewToggle />
      <SidebarChatButton />
    </div>
  );
}
