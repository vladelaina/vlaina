import { cn } from '@/lib/utils';

export type SidebarTone = 'notes' | 'chat';

const SIDEBAR_TONE_STYLES = {
  notes: {
    text: 'text-[var(--vlaina-sidebar-notes-text)]',
    softText: 'text-[var(--vlaina-sidebar-notes-text-soft)]',
    activeRow: 'bg-[var(--vlaina-sidebar-notes-row-active)] text-[var(--vlaina-sidebar-notes-text)]',
    highlightRow: 'bg-[var(--vlaina-sidebar-notes-row-hover)] text-[var(--vlaina-sidebar-notes-text)]',
    inactiveRow: 'text-[var(--vlaina-sidebar-notes-text)] hover:bg-[var(--vlaina-sidebar-notes-row-hover)]',
    rowHover: 'hover:bg-[var(--vlaina-sidebar-notes-row-hover)]',
    fade: 'from-[var(--vlaina-sidebar-notes-fade)]',
    fadeHover: 'from-[var(--vlaina-sidebar-notes-row-hover)]',
    groupFadeHover: 'group-hover/sidebar-row:from-[var(--vlaina-sidebar-notes-row-hover)]',
    fadeActive: 'from-[var(--vlaina-sidebar-notes-row-active)]',
  },
  chat: {
    text: 'text-[var(--vlaina-sidebar-chat-text)]',
    softText: 'text-[var(--vlaina-sidebar-chat-text-soft)]',
    activeRow: 'bg-[var(--vlaina-sidebar-chat-row-active)] text-[var(--vlaina-sidebar-chat-text)]',
    highlightRow: 'bg-[var(--vlaina-sidebar-chat-row-hover)] text-[var(--vlaina-sidebar-chat-text)]',
    inactiveRow: 'text-[var(--vlaina-sidebar-chat-text)] hover:bg-[var(--vlaina-sidebar-chat-row-hover)]',
    rowHover: 'hover:bg-[var(--vlaina-sidebar-chat-row-hover)]',
    fade: 'from-[var(--vlaina-sidebar-chat-fade)]',
    fadeHover: 'from-[var(--vlaina-sidebar-chat-row-hover)]',
    groupFadeHover: 'group-hover/sidebar-row:from-[var(--vlaina-sidebar-chat-row-hover)]',
    fadeActive: 'from-[var(--vlaina-sidebar-chat-row-active)]',
  },
} as const;

export const SIDEBAR_SELECTED_LABEL_WEIGHT_CLASS = 'font-[var(--vlaina-font-weight-semibold-plus)]';
export const SIDEBAR_EMPHASIZED_LABEL_WEIGHT_CLASS = 'font-medium';
export const SIDEBAR_ACTION_BUTTON_WEIGHT_CLASS = 'font-normal';
export const SIDEBAR_ROW_RADIUS_CLASS = 'rounded-xl';
export const SIDEBAR_LABEL_TEXT_METRICS_CLASS = 'text-[var(--vlaina-font-base)] leading-5';

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
  return cn(
    options.selected
      ? 'text-[var(--vlaina-sidebar-row-selected-text)]'
      : getSidebarTextClass(tone),
    getSidebarLabelWeightClass(options)
  );
}

export function getSidebarActionButtonClass(tone: SidebarTone) {
  const styles = SIDEBAR_TONE_STYLES[tone];
  return cn(styles.text, styles.rowHover, SIDEBAR_ACTION_BUTTON_WEIGHT_CLASS);
}

export function getSidebarSelectedRowSurfaceClass(tone: SidebarTone) {
  const styles = SIDEBAR_TONE_STYLES[tone];
  return cn(
    SIDEBAR_ROW_RADIUS_CLASS,
    styles.activeRow,
    'text-[var(--vlaina-sidebar-row-selected-text)]',
    'shadow-[var(--vlaina-shadow-none)] hover:shadow-[var(--vlaina-shadow-none)]',
  );
}

export function getSidebarPreviewRowSurfaceClass(tone: SidebarTone) {
  const styles = SIDEBAR_TONE_STYLES[tone];
  return cn(SIDEBAR_ROW_RADIUS_CLASS, styles.highlightRow);
}

export function getSidebarIdleRowSurfaceClass(tone: SidebarTone) {
  const styles = SIDEBAR_TONE_STYLES[tone];
  return cn(SIDEBAR_ROW_RADIUS_CLASS, 'bg-transparent', styles.inactiveRow);
}
