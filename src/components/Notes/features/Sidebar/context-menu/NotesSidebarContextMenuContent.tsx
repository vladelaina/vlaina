import type { ReactNode } from 'react';
import {
  NotesSidebarContextMenuDivider,
  NotesSidebarContextMenuItem,
} from './NotesSidebarContextMenuParts';
import { NotesSidebarContextMenuSubmenu } from './NotesSidebarContextMenuSubmenu';

export interface NotesSidebarMenuAction {
  kind?: 'item';
  key?: string;
  icon: ReactNode;
  label: ReactNode;
  onClick: () => void | Promise<unknown>;
  danger?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  className?: string;
}

export interface NotesSidebarMenuDivider {
  kind: 'divider';
  key?: string;
}

export interface NotesSidebarMenuSubmenu {
  kind: 'submenu';
  key?: string;
  icon: ReactNode;
  label: ReactNode;
  children: NotesSidebarMenuEntry[];
  className?: string;
}

export type NotesSidebarMenuEntry =
  | NotesSidebarMenuAction
  | NotesSidebarMenuDivider
  | NotesSidebarMenuSubmenu;

interface NotesSidebarContextMenuContentProps {
  entries: NotesSidebarMenuEntry[];
}

function renderEntry(entry: NotesSidebarMenuEntry, index: number): ReactNode {
  const key = entry.key ?? `${entry.kind ?? 'item'}-${index}`;

  if (entry.kind === 'divider') {
    return <NotesSidebarContextMenuDivider key={key} />;
  }

  if (entry.kind === 'submenu') {
    return (
      <NotesSidebarContextMenuSubmenu
        key={key}
        icon={entry.icon}
        label={entry.label}
        className={entry.className}
      >
        <NotesSidebarContextMenuContent entries={entry.children} />
      </NotesSidebarContextMenuSubmenu>
    );
  }

  return (
    <NotesSidebarContextMenuItem
      key={key}
      icon={entry.icon}
      label={entry.label}
      onClick={entry.onClick}
      danger={entry.danger}
      disabled={entry.disabled}
      trailing={entry.trailing}
      className={entry.className}
    />
  );
}

export function NotesSidebarContextMenuContent({
  entries,
}: NotesSidebarContextMenuContentProps) {
  return <>{entries.map((entry, index) => renderEntry(entry, index))}</>;
}
