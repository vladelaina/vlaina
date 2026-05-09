export type AiMenuItem = {
  id: string;
  label: string;
  instruction: string;
  behavior?: 'review' | 'sidebar-chat';
  icon?: 'quote';
  shortcut?: string;
};

export type AiMenuGroup = {
  id: string;
  label: string;
  items: readonly AiMenuItem[];
  tone: boolean;
  rootAction?: AiMenuItem;
};
