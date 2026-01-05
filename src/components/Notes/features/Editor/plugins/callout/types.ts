// Callout plugin types

export interface IconData {
  type: 'emoji' | 'icon';
  value: string;
  color?: string;
}

export interface CalloutBlockAttrs {
  icon: IconData;
  backgroundColor: string;
}

export const CALLOUT_COLORS = [
  'yellow',
  'blue', 
  'green',
  'red',
  'purple',
  'gray'
] as const;

export type CalloutColor = typeof CALLOUT_COLORS[number];

export const DEFAULT_CALLOUT_ICON: IconData = {
  type: 'emoji',
  value: '💡'
};
