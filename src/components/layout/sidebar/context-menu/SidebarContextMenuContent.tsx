import type { ReactNode } from 'react';
import {
  SidebarContextMenuDivider,
  SidebarContextMenuItem,
} from './SidebarContextMenuParts';
import { SidebarContextMenuSubmenu } from './SidebarContextMenuSubmenu';

export interface SidebarMenuAction {
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

export interface SidebarMenuDivider {
  kind: 'divider';
  key?: string;
}

export interface SidebarMenuSubmenu {
  kind: 'submenu';
  key?: string;
  icon: ReactNode;
  label: ReactNode;
  children: SidebarMenuEntry[];
  className?: string;
}

export type SidebarMenuEntry =
  | SidebarMenuAction
  | SidebarMenuDivider
  | SidebarMenuSubmenu;

interface SidebarContextMenuContentProps {
  entries: SidebarMenuEntry[];
}

function renderEntry(entry: SidebarMenuEntry, index: number): ReactNode {
  const key = entry.key ?? `${entry.kind ?? 'item'}-${index}`;

  if (entry.kind === 'divider') {
    return <SidebarContextMenuDivider key={key} />;
  }

  if (entry.kind === 'submenu') {
    return (
      <SidebarContextMenuSubmenu
        key={key}
        icon={entry.icon}
        label={entry.label}
        className={entry.className}
      >
        <SidebarContextMenuContent entries={entry.children} />
      </SidebarContextMenuSubmenu>
    );
  }

  return (
    <SidebarContextMenuItem
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

export function SidebarContextMenuContent({
  entries,
}: SidebarContextMenuContentProps) {
  return <>{entries.map((entry, index) => renderEntry(entry, index))}</>;
}
