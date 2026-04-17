import { cn } from '@/lib/utils';

export type SidebarTone = 'notes' | 'chat';

const SIDEBAR_TONE_STYLES = {
  notes: {
    text: 'text-[var(--notes-sidebar-text)]',
    softText: 'text-[var(--notes-sidebar-text-soft)]',
    activeRow: 'bg-[var(--notes-sidebar-row-active)] text-[var(--notes-sidebar-text)]',
    highlightRow: 'bg-[var(--notes-sidebar-row-hover)] text-[var(--notes-sidebar-text)]',
    inactiveRow: 'text-[var(--notes-sidebar-text)] hover:bg-[var(--notes-sidebar-row-hover)]',
    rowHover: 'hover:bg-[var(--notes-sidebar-row-hover)]',
    fade: 'from-[var(--notes-sidebar-fade)]',
    fadeHover: 'from-[var(--notes-sidebar-row-hover)]',
    groupFadeHover: 'group-hover/sidebar-row:from-[var(--notes-sidebar-row-hover)]',
    fadeActive: 'from-[var(--notes-sidebar-row-active)]',
  },
  chat: {
    text: 'text-[var(--chat-sidebar-text)]',
    softText: 'text-[var(--chat-sidebar-text-soft)]',
    activeRow: 'bg-[var(--chat-sidebar-row-active)] text-[var(--chat-sidebar-text)]',
    highlightRow: 'bg-[var(--chat-sidebar-row-hover)] text-[var(--chat-sidebar-text)]',
    inactiveRow: 'text-[var(--chat-sidebar-text)] hover:bg-[var(--chat-sidebar-row-hover)]',
    rowHover: 'hover:bg-[var(--chat-sidebar-row-hover)]',
    fade: 'from-[var(--chat-sidebar-fade)]',
    fadeHover: 'from-[var(--chat-sidebar-row-hover)]',
    groupFadeHover: 'group-hover/sidebar-row:from-[var(--chat-sidebar-row-hover)]',
    fadeActive: 'from-[var(--chat-sidebar-row-active)]',
  },
} as const;

export const SIDEBAR_SELECTED_LABEL_WEIGHT_CLASS = 'font-[550]';
export const SIDEBAR_EMPHASIZED_LABEL_WEIGHT_CLASS = 'font-medium';
export const SIDEBAR_ACTION_BUTTON_WEIGHT_CLASS = 'font-normal';

export function getSidebarToneStyles(tone: SidebarTone) {
  return SIDEBAR_TONE_STYLES[tone];
}

export function getSidebarTextClass(tone: SidebarTone) {
  return SIDEBAR_TONE_STYLES[tone].text;
}

export function getSidebarSoftTextClass(tone: SidebarTone) {
  return SIDEBAR_TONE_STYLES[tone].softText;
}

export function getSidebarLabelWeightClass({
  selected = false,
  emphasized = false,
}: {
  selected?: boolean;
  emphasized?: boolean;
} = {}) {
  if (selected) {
    return SIDEBAR_SELECTED_LABEL_WEIGHT_CLASS;
  }

  if (emphasized) {
    return SIDEBAR_EMPHASIZED_LABEL_WEIGHT_CLASS;
  }

  return undefined;
}

export function getSidebarLabelClass(
  tone: SidebarTone,
  options: {
    selected?: boolean;
    emphasized?: boolean;
  } = {},
) {
  return cn(getSidebarTextClass(tone), getSidebarLabelWeightClass(options));
}

export function getSidebarActionButtonClass(tone: SidebarTone) {
  const styles = SIDEBAR_TONE_STYLES[tone];
  return cn(styles.text, styles.rowHover, SIDEBAR_ACTION_BUTTON_WEIGHT_CLASS);
}
