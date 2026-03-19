export type AiMenuItem = {
  id: string;
  label: string;
  instruction: string;
};

export type AiMenuGroup = {
  id: string;
  label: string;
  items: readonly AiMenuItem[];
  tone: boolean;
};
